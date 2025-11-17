/**
 * Helper functions for guest card payment flow
 */

const WALLET_HOST = String(process.env.WALLET_HOST);
const GUEST_CARD_PAYMENT_METHOD_ID = 'f25399bf-c56f-4bd2-adc9-7aef87410609'; // TODO retrieve from getAllPaymentMethods

/**
 * Generates a random RPTID for test payments
 */
export const generateRandomRptId = (): string => {
  const randomPart = Math.floor(Math.random() * (999999999999 - 0 + 1) + 0)
    .toString()
    .padStart(12, '0');
  return `77777777777302001${randomPart}`;
};

/**
 * Guest Payment Flow - Step 1: Start new session
 */
export const startGuestSession = async (userId: string = ''): Promise<string> => {
  const url = `${WALLET_HOST}/session-wallet/mock/v1/session`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: userId,
      expiryInMinutes: 90000,
    }),
  });

  if (response.status !== 201) {
    throw new Error(
      `Failed to start session: ${response.status} - ${JSON.stringify(await response.json())}`
    );
  }

  const data = await response.json();
  console.log('✓ Session started');
  return data.token;
};

/**
 * Guest Payment Flow - Step 2: Get payment info by rptId
 */
export const getPaymentInfo = async (
  sessionToken: string,
  rptId: string
): Promise<{ paymentToken: string; amount: number }> => {
  const url = `${WALLET_HOST}/ecommerce/io/v2/payment-requests/${rptId}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    },
  });

  if (response.status !== 200) {
    throw new Error(
      `Failed to get payment info: ${response.status} - ${JSON.stringify(await response.json())}`
    );
  }

  const data = await response.json();
  console.log(`✓ Payment info retrieved: amount=${data.amount}`);
  return {
    paymentToken: data.paymentContextCode,
    amount: data.amount,
  };
};

/**
 * Guest Payment Flow - Step 3: Get redirect URL for card save choice page
 */
export const getGuestCardRedirectUrl = async (
  sessionToken: string,
  rptId: string,
  amount: number
): Promise<string> => {
  const url = `${WALLET_HOST}/ecommerce/io/v2/payment-methods/${GUEST_CARD_PAYMENT_METHOD_ID}/redirectUrl?rpt_id=${rptId}&amount=${amount}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    },
  });

  if (response.status !== 200) {
    throw new Error(
      `Failed to get redirect URL: ${response.status} - ${JSON.stringify(await response.json())}`
    );
  }

  const data = await response.json();
  console.log('✓ Redirect URL retrieved');
  return data.redirectUrl;
};

/**
 * Guest Payment Flow - Step 4: Start new eCommerce transaction
 */
export const startGuestTransaction = async (
  sessionToken: string,
  rptId: string,
  amount: number
): Promise<{ transactionId: string }> => {
  const url = `${WALLET_HOST}/ecommerce/io/v2/transactions`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({
      paymentNotices: [
        {
          rptId: rptId,
          amount: amount,
        },
      ],
    }),
  });

  if (response.status !== 200) {
    const errorBody = await response.json();
    throw new Error(
      `Failed to start transaction: ${response.status} - ${JSON.stringify(errorBody)}`
    );
  }

  const data = await response.json();
  console.log(`✓ Transaction started: ${data.transactionId}`);

  return {
    transactionId: data.transactionId,
  };
};

/**
 * Guest Payment Flow - Step 5: Calculate fees for guest payment
 */
export const calculateGuestFees = async (
  sessionToken: string,
  paymentMethodId: string,
  orderId: string,
  amount: number,
  targetPspId?: string
): Promise<{ pspId: string; fee: number }> => {
  const url = `${WALLET_HOST}/ecommerce/io/v2/payment-methods/${paymentMethodId}/fees`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({
      orderId: orderId,
      language: 'it',
      paymentAmount: amount,
      primaryCreditorInstitution: '77777777777',
      isAllCCP: true,
      transferList: [
        {
          creditorInstitution: '77777777777',
          digitalStamp: false,
          transferCategory: '77777777777',
        },
      ],
    }),
  });

  if (response.status !== 200) {
    throw new Error(
      `Failed to calculate fees: ${response.status} - ${JSON.stringify(await response.json())}`
    );
  }

  const data = await response.json();
  console.log(`✓ Fees calculated: ${data.bundles?.length || 0} bundles found`);

  // Find the target PSP or use the first one
  let selectedBundle;
  if (targetPspId) {
    selectedBundle = data.bundles?.find((b: any) => b.idPsp === targetPspId);
    if (!selectedBundle) {
      console.warn(`PSP ${targetPspId} not found, using first bundle`);
      selectedBundle = data.bundles?.[0];
    }
  } else {
    selectedBundle = data.bundles?.[0];
  }

  if (!selectedBundle) {
    throw new Error('No fee bundles available');
  }

  return {
    pspId: selectedBundle.idPsp,
    fee: selectedBundle.taxPayerFee,
  };
};

/**
 * Guest Payment Flow - Step 7: Create authorization request for guest payment
 */
export const createGuestAuthorizationRequest = async (
  sessionToken: string,
  transactionId: string,
  orderId: string,
  paymentMethodId: string,
  amount: number,
  fee: number,
  pspId: string
): Promise<string> => {
  const url = `${WALLET_HOST}/ecommerce/io/v2/transactions/${transactionId}/auth-requests`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({
      amount: amount,
      fee: fee,
      pspId: pspId,
      language: 'IT',
      isAllCCP: true,
      details: {
        detailType: 'cards',
        orderId: orderId,
        paymentMethodId: paymentMethodId,
      },
    }),
  });

  if (response.status !== 200) {
    throw new Error(
      `Failed to create auth request: ${response.status} - ${JSON.stringify(
        await response.json()
      )}`
    );
  }

  const data = await response.json();
  console.log('✓ Authorization URL created');
  return data.authorizationUrl;
};

/**
 * Complete guest payment flow - returns the card save choice page URL
 */
export const retrieveGuestPaymentAuthUrl = async (
  targetPspId?: string
): Promise<string> => {
  const PAYMENT_USER_ID = String(process.env.PAYMENT_USER_ID);
  const rptId = generateRandomRptId();
  console.log(`Generated RPTID: ${rptId}`);

  // Step 1: Start session with userId
  const sessionToken = await startGuestSession(PAYMENT_USER_ID);

  // Step 2: Get payment info
  const { amount } = await getPaymentInfo(sessionToken, rptId);

  // Step 3: Get redirect URL → this returns the card save choice page
  const redirectUrl = await getGuestCardRedirectUrl(sessionToken, rptId, amount);

  console.log('✓ Guest payment flow completed - ready to navigate to choice page');
  return redirectUrl;
};