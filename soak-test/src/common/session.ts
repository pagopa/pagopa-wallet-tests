import { fail } from "k6";
import http from "k6/http";
import { Environment } from "./utils";

type CreateSessionResponse = {
    token: string
}

const mockSessionUrl = {
    "dev": "https://api.dev.platform.pagopa.it/session-wallet/mock/v1/session",
    "uat": "https://api.uat.platform.pagopa.it/session-wallet/mock/v1/session",
}

export function createWalletToken(env: Environment, userId: string, expiryInMinutes: number) {
    const url = mockSessionUrl[env]
    const response = http.post(url, JSON.stringify({
        userId: userId,
        expiryInMinutes: expiryInMinutes
    }));
    const walletToken = ((response.json()) as CreateSessionResponse).token;
    if (!walletToken) {
        fail("Failed to get wallet token");
    }
    return walletToken;
}