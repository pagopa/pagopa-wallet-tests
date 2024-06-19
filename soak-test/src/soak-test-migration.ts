import http from "k6/http";
import { getConfigOrThrow, getVersionedBaseUrl } from "./common/config";
import { check, fail } from "k6";
import { WalletPmCardDetailsRequest } from "./generated/wallet-migration-v1/WalletPmCardDetailsRequest";
import { charsetAlphanumeric, randomIntBetween, randomString, uuid } from "./common/utils";
import { WalletPmDeleteRequest } from "./generated/wallet-migration-v1/WalletPmDeleteRequest";
import { WalletPmAssociationRequest } from "./generated/wallet-migration-nexi-v1/WalletPmAssociationRequest";
import { WalletPmAssociationResponse } from "./generated/wallet-migration-nexi-v1/WalletPmAssociationResponse";

const config = getConfigOrThrow();

const apiTags = {
    generateContract: "generate-contract",
    updateWallet: "update-wallet",
    deleteWallet: "delete-wallet"
}

export let options = {
    scenarios: {
        constant_request_rate: {
            executor: 'constant-arrival-rate',
            rate: config.rate,
            timeUnit: '1s',
            duration: config.duration,
            preAllocatedVUs: config.preAllocatedVUs,
            maxVUs: config.maxVUs,
        },
    },
    thresholds: {
        http_req_duration: ["p(99)<1500"], // 99% of requests must complete below 1.5s
        checks: ['rate>0.9'], // 90% of the request must be completed
        [`http_req_duration{name:${apiTags.generateContract}}`]: ["p(95)<1000"],//95% of post carts request must complete below 1s
        [`http_req_duration{name:${apiTags.updateWallet}}`]: ["p(95)<1000"],//95% of post carts request must complete below 1s
        [`http_req_duration{name:${apiTags.deleteWallet}}`]: ["p(95)<1000"],//95% of post carts request must complete below 1s
    },
};

const headerParams = {
    headers: {
        "Content-Type": "application/json",
        "Ocp-Apim-Subscription-Key": config.API_SUBSCRIPTION_KEY
    },
}

const urlBasePathImportV1 = getVersionedBaseUrl(config.URL_BASE_PATH, "v1");
const urlBasePathGenerateV1 = getVersionedBaseUrl(config.URL_BASE_PATH_GENERATE_CONTRACT, "v1");

export function setup() {
    console.log("Setup", JSON.stringify(config))
}

export default function () {

    // 1. Generate contract id
    const requestPm = randomPmRequest();
    const response = http.put(
        `${urlBasePathGenerateV1}/migrations/wallets`,
        JSON.stringify(requestPm),
        {
            headers: {
                "Content-Type": "application/json",
                "Ocp-Apim-Subscription-Key": config.API_SUBSCRIPTION_KEY_GENERATE_CONTRACT
            },
            timeout: '10s',
            tags: { name: apiTags.generateContract },
        }
    );

    check(
        response,
        { "Response from PUT /migrations/wallets was 200": (r) => r.status == 200 },
        { name: apiTags.generateContract }
    );

    if (response.status != 200) {
        fail(`Error during contract generation ${response.status}`);
    }

    const responseBody = response.json() as WalletPmAssociationResponse;
   
    // 2. update or delete wallet
    if (Math.random() <= config.DELETE_RATIO) {
        // delete wallet
        const request = generateDeleteRequest(responseBody.contractId);
        const response = http.post(
            `${urlBasePathImportV1}/migrations/wallets/delete`,
            JSON.stringify(request),
            {
                headers: {
                    "x-contract-hmac": responseBody.contractId,
                    ...headerParams.headers
                },
                timeout: '10s',
                tags: { name: apiTags.deleteWallet },
            }
        );
        check(
            response,
            { "Response from POST /migrations/delete was 200": (r) => r.status == 204 },
            { name: apiTags.deleteWallet }
        );
    } else {
        // update wallet
        const request = generateUpdateRequest(responseBody.contractId);
        const response = http.post(
            `${urlBasePathImportV1}/migrations/wallets/updateDetails`,
            JSON.stringify(request),
            {
                headers: {
                    "x-contract-hmac": responseBody.contractId,
                    ...headerParams.headers
                },
                timeout: '10s',
                tags: { name: apiTags.updateWallet },
            }
        );
        check(
            response,
            { "Response from PUT /migrations/updateDetails was 200": (r) => r.status == 200 },
            { name: apiTags.updateWallet }
        );
    }
}


function randomPmRequest(): WalletPmAssociationRequest {
    return {
        walletIdPm: randomIntBetween(1, 1_000_000_000),
        fiscalCode: randomString(16, charsetAlphanumeric),
    }
}

function generateUpdateRequest(contractId: string): WalletPmCardDetailsRequest {
    const expireDate = new Date();
    const monthAsString = expireDate.getMonth().toString();
    const formattedMonth = monthAsString.length == 1 ? `0${monthAsString}` : monthAsString;
    return {
        contractIdentifier: contractId,
        cardBin: randomIntBetween(10_000_000, 99_999_999),
        lastFourDigits: randomIntBetween(1_000, 9_999),
        newContractIdentifier: contractId,
        paymentCircuit: "VISA",
        paymentGatewayCardId: uuid().split("-").join(""),
        expiryDate: `${formattedMonth}/${expireDate.getFullYear().toString().slice(-2)}`
    }
}

function generateDeleteRequest(contractId: string): WalletPmDeleteRequest {
    return {
        contractIdentifier: contractId
    }
}