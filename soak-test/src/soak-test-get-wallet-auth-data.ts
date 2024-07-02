import http from "k6/http";
import { getConfigOrThrow, getVersionedBaseUrl } from "./common/config";
import { check, fail } from "k6";
import { createWalletToken } from "./common/session";
import { getEnvironment } from "./common/utils";
import { SharedArray } from "k6/data";
import { getWalletsByUserId } from "./common/wallet-client";

const config = getConfigOrThrow();

const apiTags = {
    getWalletAuthData: "get-wallet-auth-data"
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
        [`http_req_duration{name:${apiTags.getWalletAuthData}}`]: ["p(95)<1000"]
    },
};

const urlBasePath = getVersionedBaseUrl(config.URL_BASE_PATH, "payment-wallet-for-ecommerce/v1");
const environment = getEnvironment(config.URL_BASE_PATH);

let walletIds: string[];

export default function () {

    if (!walletIds) {
        const token = createWalletToken(environment, config.WALLET_USER_ID!!, 60);
        const wallets = getWalletsByUserId(getVersionedBaseUrl(config.URL_BASE_PATH, "io-payment-wallet/v1"), token, true);
        console.log(wallets);
        walletIds = wallets.wallets?.map(it => it.walletId) ?? [];
    }

    const walletId = walletIds[Math.floor(Math.random() * walletIds.length)];
    const response = http.get(`${urlBasePath}/wallets/${walletId}/auth-data`,
        {
            headers: {
                "Content-Type": "application/json",
            },
            timeout: '10s',
            tags: { name: apiTags.getWalletAuthData },
        }
    )

    check(
        response,
        { "Response from GET /wallets/{walletId}/auth-data was 200": (r) => r.status == 200 },
        { name: apiTags.getWalletAuthData }
    );
}