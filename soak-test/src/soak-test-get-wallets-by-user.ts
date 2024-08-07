import http from "k6/http";
import { getConfigOrThrow, getVersionedBaseUrl } from "./common/config";
import { check, fail } from "k6";
import { createWalletToken } from "./common/session";
import { generateProgressiveUUID, generateUuidArray, getEnvironment } from "./common/utils";
import { SharedArray } from "k6/data";
import { Wallets } from "./generated/wallet/Wallets";

const config = getConfigOrThrow();

const walletApiKey = config.WALLET_AUTH_DATA_API_KEY;

const apiTags = {
    getWallets: "get-wallets",
    getAuthData: "get-auth-data"
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
        [`http_req_duration{name:${apiTags.getWallets}}`]: ["p(95)<1000"],
        [`http_req_duration{name:${apiTags.getAuthData}}`]: ["p(95)<1000"]
    },
};

const DEFAULT_TOKEN_VALIDITY = 24 * 60; // 1 day
const urlBasePath = getVersionedBaseUrl(config.URL_BASE_PATH, "io-payment-wallet/v1");
const urlWalletForEcommerceBasePath = getVersionedBaseUrl(config.URL_BASE_PATH, "payment-wallet-for-ecommerce/v1");
const environment = getEnvironment(config.URL_BASE_PATH);

const userIds = new SharedArray("userIds", () => {
    if (!config.WALLET_USER_ID_START || !config.WALLET_USER_COUNT) {
        fail("Missing mandatory WALLET_USER_ID_START and WALLET_USER_COUNT")
    }
    return generateProgressiveUUID(config.WALLET_USER_ID_START!!, config.WALLET_USER_COUNT!!);
});

export function setup() {
}

export default function () {
    const userId = userIds[Math.floor(Math.random() * userIds.length)];
    const walletToken = createWalletToken(environment, userId, DEFAULT_TOKEN_VALIDITY);

    // Get wallets by user id
    let response = http.get(
        `${urlBasePath}/wallets`,
        {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${walletToken}`,
                ...(config.USE_BLUE_DEPLOYMENT == "True" ? {"deployment": "blue" } : {}),
            },
            timeout: '10s',
            tags: { name: apiTags.getWallets },
        }
    );

    check(
        response,
        { "Response from GET /wallets was 200": (r) => r.status == 200 },
        { name: apiTags.getWallets }
    );

    const data = response.json() as Wallets;
    if(data.wallets?.length > 0) {
        const validatedWallets = data.wallets?.filter(w => w.status === "VALIDATED");
        if(validatedWallets?.length > 0) {
            const idWallet = validatedWallets[0].walletId;
            let responseAuthData = http.get(
                `${urlWalletForEcommerceBasePath}/wallets/${idWallet}/auth-data`,
                {
                    headers: {
                        "Content-Type": "application/json",
                        "Ocp-Apim-Subscription-Key": `${walletApiKey}`,
                        ...(config.USE_BLUE_DEPLOYMENT == "True" ? {"deployment": "blue" } : {}),
                    },
                    timeout: '10s',
                    tags: { name: apiTags.getAuthData },
                }
            );
            check(
                responseAuthData,
                { "Response from GET /wallet/:idWallet/authData was 200": (r) => r.status == 200 },
                { name: apiTags.getAuthData }
            );
        }
    }
}