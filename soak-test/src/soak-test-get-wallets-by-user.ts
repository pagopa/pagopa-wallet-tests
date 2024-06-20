import http from "k6/http";
import { getConfigOrThrow, getVersionedBaseUrl } from "./common/config";
import { check, fail } from "k6";
import { paymentMethodsIdsFor, randomPaymentMethod } from "./common/payment-methods";

const config = getConfigOrThrow();

const apiTags = {
    getWallets: "get-wallets"
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
        [`http_req_duration{name:${apiTags.getWallets}}`]: ["p(95)<1000"]
    },
};

const urlBasePath = getVersionedBaseUrl(config.URL_BASE_PATH, "payment-wallet/v1");

export function setup() {
    if (!config.WALLET_TOKEN) {
        fail("Missing WALLET_TOKEN")
    }
}

export default function () {
    
    // Get wallets by user id
    let response = http.get(
        `${urlBasePath}/wallets`,
        {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${config.WALLET_TOKEN}`
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
}