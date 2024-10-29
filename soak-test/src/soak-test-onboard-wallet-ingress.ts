import http from "k6/http";
import { getConfigOrThrow } from "./common/config";
import { check, fail, sleep } from "k6";
import { extractFragment, uuid, } from "./common/utils";
import { WalletCreateRequest } from "./generated/wallet/WalletCreateRequest";
import { SessionInputData1, SessionInputData2, } from "./generated/wallet-webview/SessionInputData";
import { SessionInputDataTypeCardsEnum } from "./generated/wallet-webview/SessionInputDataTypeCards";
import { SessionWalletCreateResponse } from "./generated/wallet-webview/SessionWalletCreateResponse";
import { WalletCreateResponse } from "./generated/wallet/WalletCreateResponse";
import { SessionInputDataTypePaypalEnum } from "./generated/wallet-webview/SessionInputDataTypePaypal";
import { PaymentMethod, paymentMethodsIdsFor, randomPaymentMethod, } from "./common/payment-methods";

const config = getConfigOrThrow();

const apiTags = {
  createWallet: "create-wallet",
  getPsps: "get-psps",
  createSession: "create-session",
  createValidation: "create-validation",
  getSession: "get-session",
  doNotification: "do-notification",
  changeAppStatusDisable: "change-app-status-disable",
  changeAppStatusEnable: "change-app-status-enable",
  deleteWallet: "delete-wallet",
};

export let options = {
  //iterations: 5,
  scenarios: {
    constant_request_rate: {
      executor: "ramping-arrival-rate",
      startRate: 0,
      timeUnit: "1s",
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
    checks: ["rate>0.9"], // 90% of the request must be completed
    [`http_req_duration{name:${apiTags.createWallet}}`]: ["p(95)<1000"],
    [`http_req_duration{name:${apiTags.getPsps}}`]: ["p(95)<1000"],
    [`http_req_duration{name:${apiTags.createSession}}`]: ["p(95)<1000"],
    [`http_req_duration{name:${apiTags.createValidation}}`]: ["p(95)<1000"],
    [`http_req_duration{name:${apiTags.getSession}}`]: ["p(95)<1000"],
    [`http_req_duration{name:${apiTags.doNotification}}`]: ["p(95)<1000"],
    [`http_req_duration{name:${apiTags.changeAppStatusDisable}}`]: ["p(95)<1000"],
    [`http_req_duration{name:${apiTags.changeAppStatusEnable}}`]: ["p(95)<1000"],
    [`http_req_duration{name:${apiTags.deleteWallet}}`]: ["p(95)<1000"],
  },
};

const POLLING_ATTEMPTS = 5;
const DEFAULT_APM_PSP = "BCITITMM";

const urlBasePath = config.URL_BASE_PATH;
const paymentMethodIds = paymentMethodsIdsFor(urlBasePath);

export function setup() {
  if (config.ONBOARD_APM_RATIO == undefined) {
    fail("Missing ONBOARD_APM_RATIO");
  }

}

export default function () {
  const userId = uuid();
  const paymentMethod = randomPaymentMethod(config.ONBOARD_APM_RATIO ?? 0);
  const paymentMethodId = paymentMethodIds[paymentMethod];

  const commonHeaders = {
    "x-user-id": userId,
    "x-client-id": "IO",
    "Content-Type": "application/json",
  };

  // 1. Create wallet
  const request: WalletCreateRequest = {
    applications: ["PAGOPA"],
    useDiagnosticTracing: true,
    paymentMethodId: paymentMethodId,
  } as WalletCreateRequest;
  let response = http.post(`${urlBasePath}/wallets`, JSON.stringify(request), {
    headers: { ...commonHeaders },
    timeout: "10s",
    tags: { name: apiTags.createWallet },
  });

  check(
    response,
    { "Response from POST /wallets was 201": (r) => r.status == 201 },
    { name: apiTags.createWallet }
  );

  if (response.status != 201 || response.json() == null) {
    fail(`Error during wallet create ${response.status}`);
  }
  const walletResponse = response.json() as WalletCreateResponse;
  const walletId = extractFragment(walletResponse.redirectUrl, "walletId");

  // 2. POST /sessions
  const requestInputData = generateSessionInputData(
    paymentMethod == PaymentMethod.PAYPAL,
    DEFAULT_APM_PSP
  );
  response = http.post(
    `${urlBasePath}/wallets/${walletId}/sessions`,
    JSON.stringify(requestInputData),
    {
      headers: { ...commonHeaders },
      timeout: "10s",
      tags: { name: apiTags.createSession },
    }
  );
  check(
    response,
    {
      "Response from POST /wallets/{walletId}/sessions was 200": (r) =>
        r.status == 200,
    },
    { name: apiTags.createSession }
  );

  if (response.status != 200) {
    fail(`Error during create session ${response.status}`);
  }

  const session = response.json() as SessionWalletCreateResponse;
  const orderId = session.orderId;

  // 3. Create validation
  if (paymentMethod == PaymentMethod.CARDS) {
    response = http.post(
      `${urlBasePath}/wallets/${walletId}/sessions/${orderId}/validations`,
      JSON.stringify({}),
      {
        headers: { ...commonHeaders },
        timeout: "10s",
        tags: { name: apiTags.createValidation },
      }
    );
    check(
      response,
      {
        "Response from POST /wallets/{walletId}/sessions/{orderId}/validations was 200":
          (r) => r.status == 200,
      },
      { name: apiTags.createValidation }
    );

    if (response.status != 200) {
      fail(`Error during POST validations ${response.url} ${response.status}`);
    }
  }

  // 4. Polling
  for (let i = 0; i < POLLING_ATTEMPTS; i++) {
    response = http.get(
      `${urlBasePath}/wallets/${walletId}/sessions/${orderId}`,
      {
        headers: { ...commonHeaders },
        timeout: "10s",
        tags: { name: apiTags.getSession },
      }
    );
    check(
      response,
      {
        "Response from GET /wallets/{walletId}/sessions/{orderId} was 200": (
          r
        ) => r.status == 200,
      },
      { name: apiTags.getSession }
    );
    if (response.status != 200 || response.json() == null) {
      fail(`Error during get transaction ${response.status}`);
    }
    sleep(3);
  }

  let notificationBody;
  switch (paymentMethod) {
    case PaymentMethod.CARDS:
      notificationBody = {
        details: {
          paymentInstrumentGatewayId: "",
          type: "CARD",
        },
        operationId: "operationId",
        operationResult: "EXECUTED",
        timestampOperation: "2023-11-24T09:16:15.913748361Z",
      };
      break;
    case PaymentMethod.PAYPAL:
      notificationBody = {
        details: {
          maskedEmail: "t***@t****.it",
          type: "PAYPAL",
        },
        operationId: "operationId",
        operationResult: "EXECUTED",
        timestampOperation: "2023-11-24T09:16:15.913748361Z",
      };
      break;
    default:
      fail(`Unmanaged payment method: [${paymentMethod}}]`)
  }
  // 5 wallet notification
  if (paymentMethod == PaymentMethod.CARDS) {
    response = http.post(
      `${urlBasePath}/wallets/${walletId}/sessions/${orderId}/notifications`,
      JSON.stringify(notificationBody),
      {
        headers: { ...commonHeaders, authorization: "Bearer securityToken" },
        timeout: "10s",
        tags: { name: apiTags.doNotification },
      }
    );
    check(
      response,
      {
        "Response from POST /wallets/{walletId}/sessions/{orderId}/notifications was 200":
          (r) => r.status == 200,
      },
      { name: apiTags.doNotification }
    );

    if (response.status != 200) {
      fail(
        `Error during POST notifications ${response.url} ${response.status}`
      );
    }
    sleep(2);
  }

  // 6 disable application
  response = http.put(
    `${urlBasePath}/wallets/${walletId}/applications`,
    JSON.stringify({
      applications: [{ name: "PAGOPA", status: "DISABLED" }],
    }),
    {
      headers: { ...commonHeaders },
      timeout: "10s",
      tags: { name: apiTags.changeAppStatusDisable },
    }
  );
  check(
    response,
    {
      "Response from PUT /wallets/{walletId}/applications was 204": (r) =>
        r.status == 204,
    },
    { name: apiTags.changeAppStatusDisable }
  );

  if (response.status != 204) {
    fail(`Error during PUT applications ${response.url} ${response.status}`);
  }
  sleep(2);

  // 7 re-enable application
  response = http.put(
    `${urlBasePath}/wallets/${walletId}/applications`,
    JSON.stringify({
      applications: [{ name: "PAGOPA", status: "ENABLED" }],
    }),
    {
      headers: { ...commonHeaders },
      timeout: "10s",
      tags: { name: apiTags.changeAppStatusEnable },
    }
  );
  check(
    response,
    {
      "Response from PUT /wallets/{walletId}/applications was 204": (r) =>
        r.status == 204,
    },
    { name: apiTags.changeAppStatusEnable }
  );

  if (response.status != 204) {
    fail(`Error during PUT applications ${response.url} ${response.status}`);
  }
  sleep(2);

  // 7 delete the wallet
  response = http.del(
    `${urlBasePath}/wallets/${walletId}`,
    JSON.stringify({}),
    {
      headers: {
        "x-user-id": userId,
      },
      timeout: "10s",
      tags: { name: apiTags.deleteWallet },
    }
  );
  check(
    response,
    {
      "Response from DELETE /wallets/{walletId} was 200": (r) =>
        r.status == 204,
    },
    { name: apiTags.deleteWallet }
  );

  if (response.status != 204) {
    fail(`Error during DELETE wallet ${response.url} ${response.status}`);
  }
}

export function generateSessionInputData(isApm: boolean, pspId?: string) {
  if (isApm) {
    return {
      paymentMethodType: SessionInputDataTypePaypalEnum.paypal,
      pspId: pspId,
    } as SessionInputData2;
  } else {
    return {
      paymentMethodType: SessionInputDataTypeCardsEnum.cards,
    } as SessionInputData1;
  }
}
