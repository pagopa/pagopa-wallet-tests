import http from "k6/http";
import { getConfigOrThrow, getVersionedBaseUrl } from "./common/config";
import { check, fail, sleep } from "k6";
import { extractFragment } from "./common/utils";
import { WalletCreateRequest } from "./generated/wallet/WalletCreateRequest";
import { SessionInputData1, SessionInputData2 } from "./generated/wallet-webview/SessionInputData";
import { SessionInputDataTypeCardsEnum } from "./generated/wallet-webview/SessionInputDataTypeCards";
import { SessionWalletCreateResponse } from "./generated/wallet-webview/SessionWalletCreateResponse";
import { WalletCreateResponse } from "./generated/wallet/WalletCreateResponse";
import { SessionInputDataTypePaypalEnum } from "./generated/wallet-webview/SessionInputDataTypePaypal";
import { PaymentMethod, paymentMethodsIdsFor, randomPaymentMethod } from "./common/payment-methods";

const config = getConfigOrThrow();

const apiTags = {
    createWallet: "create-wallet",
    getPsps: "get-psps",
    createSession: "create-session",
    createValidation: "create-validation",
    getSession: "get-session"
}

export let options = {
    scenarios: {
        constant_request_rate: {
            executor: 'ramping-arrival-rate',
            startRate: 0,
            timeUnit: '1s',
            preAllocatedVUs: config.preAllocatedVUs,
            maxVUs: config.maxVUs,
            stages: [
                { target: config.rate, duration: config.rampingDuration },
                { target: config.rate, duration: config.duration },
                { target: 0, duration: config.rampingDuration },
              ],
        },
    },
    thresholds: {
        http_req_duration: ["p(99)<1500"], // 99% of requests must complete below 1.5s
        checks: ['rate>0.9'], // 90% of the request must be completed
        [`http_req_duration{name:${apiTags.createWallet}}`]: ["p(95)<1000"],
        [`http_req_duration{name:${apiTags.getPsps}}`]: ["p(95)<1000"],
        [`http_req_duration{name:${apiTags.createSession}}`]: ["p(95)<1000"],
        [`http_req_duration{name:${apiTags.createValidation}}`]: ["p(95)<1000"],
        [`http_req_duration{name:${apiTags.getSession}}`]: ["p(95)<1000"],
    },
};

const POLLING_ATTEMPTS = 5
const DEFAULT_APM_PSP = "BCITITMM"

const urlBasePath = getVersionedBaseUrl(config.URL_BASE_PATH, "payment-wallet/v1");
const urlBasePathWebView = getVersionedBaseUrl(config.URL_BASE_PATH, "webview-payment-wallet/v1");
const paymentMethodIds = paymentMethodsIdsFor(urlBasePath);

export function setup() {
    if (!config.WALLET_TOKEN) {
        fail("Missing WALLET_TOKEN")
    }
    if (config.ONBOARD_APM_RATIO == undefined) {
        fail("Missing ONBOARD_APM_RATIO")
    }
}

export default function () {
    const paymentMethod = randomPaymentMethod(config.ONBOARD_APM_RATIO ?? 0);
    const paymentMethodId = paymentMethodIds[paymentMethod];

    // 1. Create wallet
    const request: WalletCreateRequest = {
        applications: [ "PAGOPA"],
        useDiagnosticTracing: true,
        paymentMethodId: paymentMethodId
    } as WalletCreateRequest
    let response = http.post(
        `${urlBasePath}/wallets`,
        JSON.stringify(request),
        {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${config.WALLET_TOKEN}`,
                ...(config.USE_BLUE_DEPLOYMENT == "True" ? {"deployment": "blue" } : {}),
            },
            timeout: '10s',
            tags: { name: apiTags.createWallet },
        }
    );

    check(
        response,
        { "Response from POST /wallets was 201": (r) => r.status == 201 },
        { name: apiTags.createWallet }
    );

    if (response.status != 201 || response.json() == null) {
        fail(`Error during wallet create ${response.status}`);
    }

    const walletResponse = response.json() as WalletCreateResponse
    const walletId = extractFragment(walletResponse.redirectUrl, "walletId")
    const sessionToken = extractFragment(walletResponse.redirectUrl, "sessionToken")

    const sessionHeaders = {
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${sessionToken}`,
            ...(config.USE_BLUE_DEPLOYMENT == "True" ? {"deployment": "blue" } : {}),
        },
    }

    // Pre 2. -> APM retrieve available psps
    let selectedPspId = undefined;
    if (paymentMethod == PaymentMethod.PAYPAL) {
        response = http.get(
            `${urlBasePathWebView}/wallets/${walletId}/psps`,
            {
                ...sessionHeaders,
                timeout: '10s',
                tags: { name: apiTags.getPsps },
            }
        );
        check(
            response,
            { "Response from GET /wallets/{walletId}/psps was 200": (r) => r.status == 200},
            { name: apiTags.getPsps }
        );
        if (response.status != 200 && response.json() == null) {
            fail(`Failed to get psp list ${response.status}`)
        }

        selectedPspId = DEFAULT_APM_PSP
    }

    // 2. POST /sessions
    const requestInputData = generateSessionInputData(paymentMethod == PaymentMethod.PAYPAL, selectedPspId);
    response = http.post(
        `${urlBasePathWebView}/wallets/${walletId}/sessions`,
        JSON.stringify(requestInputData),
        {
            ...sessionHeaders,
            timeout: '10s',
            tags: { name: apiTags.createSession },
        }
    );
    check(
        response,
        { "Response from POST /wallets/{walletId}/sessions was 200": (r) => r.status == 200},
        { name: apiTags.createSession }
    );

    if (response.status != 200) {
        fail(`Error during create session ${response.status}`);
    }

    const session = (response.json()) as SessionWalletCreateResponse
    const orderId = session.orderId

    // 3. Create validation
    response = http.post(
        `${urlBasePathWebView}/wallets/${walletId}/sessions/${orderId}/validations`,
        JSON.stringify({}),
        {
            ...sessionHeaders,
            timeout: '10s',
            tags: { name: apiTags.createValidation },
        }
    );
    check(
        response,
        { "Response from POST /wallets/{walletId}/sessions/{orderId}/validations was 200": (r) => r.status == 200},
        { name: apiTags.createValidation }
    );

    if (response.status != 200) {
        fail(`Error during POST validations ${response.url} ${response.status}`);
    }

    // 4. Notify?

    // 5. Polling
    for (let i = 0; i < POLLING_ATTEMPTS; i++) {
        response = http.get(
            `${urlBasePathWebView}/wallets/${walletId}/sessions/${orderId}`,
            {
                ...sessionHeaders,
                timeout: '10s',
                tags: { name: apiTags.getSession },
            }
        );
        check(
            response,
            { "Response from GET /wallets/{walletId}/sessions/{orderId} was 200": (r) => r.status == 200},
            { name: apiTags.getSession }
        );
        if (response.status != 200 || response.json() == null) {
            fail(`Error during get transaction ${response.status}`);
        }
        sleep(3);   
    }
}

export function generateSessionInputData(isApm: boolean, pspId?: string) {
    if (isApm) {
        return {
            paymentMethodType: SessionInputDataTypePaypalEnum.paypal,
            pspId: pspId
        } as SessionInputData2;
    } else {
        return { paymentMethodType: SessionInputDataTypeCardsEnum.cards } as SessionInputData1
    }
}