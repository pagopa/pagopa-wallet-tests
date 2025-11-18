/**
 * Helper functions for guest card payment flow
 */

import { getAllPaymentMethods } from './paymentMethodHelpers';

const WALLET_HOST = String(process.env.WALLET_HOST);

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
 * Guest Payment Flow - Start new session
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
 * Guest Payment Flow - Get payment info by rptId
 *
 * @param sessionToken - Session token from startGuestSession
 * @param rptId - Random RPT ID generated for the test
 * @returns Payment token and amount
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
  console.log(`✓ Payment info retrieved`);
  return {
    paymentToken: data.paymentContextCode,
    amount: data.amount,
  };
};

/**
 * Guest Payment Flow - Get redirect URL for card save choice page
 *
 * @param sessionToken - Session token from startGuestSession
 * @param paymentMethodId - Payment method ID from getAllPaymentMethods
 * @param rptId - Random RPT ID generated for the test
 * @param amount - Payment amount in cents
 * @returns Redirect URL to the card save choice page
 */
export const getGuestCardRedirectUrl = async (
  sessionToken: string,
  paymentMethodId: string,
  rptId: string,
  amount: number
): Promise<string> => {
  const url = `${WALLET_HOST}/ecommerce/io/v2/payment-methods/${paymentMethodId}/redirectUrl?rpt_id=${rptId}&amount=${amount}`;
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
 * Guest Payment Flow - Start new eCommerce transaction
 *
 * @param sessionToken - Session token from startGuestSession
 * @param rptId - Random RPT ID generated for the test
 * @param amount - Payment amount in cents
 * @returns Transaction ID
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
 * Guest Payment Flow - Calculate fees for guest payment
 *
 * This uses orderId (unlike contextual onboarding which uses walletId).
 * For testing purposes, PSP is ALWAYS BNLIITRR with fee 95.
 *
 * @param sessionToken - Session token from startGuestSession
 * @param paymentMethodId - Payment method ID (card payment method)
 * @param orderId - Order ID extracted from card entry outcome URL
 * @param amount - Payment amount in cents
 * @returns Object with pspId (always BNLIITRR) and fee (always 95)
 */
export const calculateGuestFees = async (
  sessionToken: string,
  paymentMethodId: string,
  orderId: string,
  amount: number
): Promise<{ pspId: string; fee: number }> => {
  const url = `${WALLET_HOST}/ecommerce/io/v2/payment-methods/${paymentMethodId}/fees`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({
      orderId: orderId, // guest payment uses orderId instead of walletId
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

  // for testing purposes we use BNLIITRR with fee 95
  const REQUIRED_PSP_ID = 'BNLIITRR';
  const REQUIRED_FEE = 95;

  const selectedBundle = data.bundles?.find((b: any) => b.idPsp === REQUIRED_PSP_ID);

  if (!selectedBundle) {
    const availablePsps = data.bundles?.map((b: any) => b.idPsp).join(', ') || 'none';
    throw new Error(
      `Required PSP ${REQUIRED_PSP_ID} not found in fee bundles. Available PSPs: ${availablePsps}`
    );
  }

  // Validate the fee is correct
  if (selectedBundle.taxPayerFee !== REQUIRED_FEE) {
    console.warn(
      `Expected fee ${REQUIRED_FEE} for PSP ${REQUIRED_PSP_ID}, but got ${selectedBundle.taxPayerFee}`
    );
  }

  console.log(`✓ Using PSP: ${REQUIRED_PSP_ID}, Fee: ${selectedBundle.taxPayerFee}`);

  return {
    pspId: selectedBundle.idPsp,
    fee: selectedBundle.taxPayerFee,
  };
};

/**
 * Guest Payment Flow - Create authorization request for guest payment
 *
 * @param sessionToken - Session token from startGuestSession
 * @param transactionId - Transaction ID from startGuestTransaction
 * @param orderId - Order ID extracted from card entry outcome URL
 * @param paymentMethodId - Payment method ID from getAllPaymentMethods
 * @param amount - Payment amount in cents
 * @param fee - Fee from calculateGuestFees
 * @param pspId - PSP ID from calculateGuestFees
 * @returns Authorization URL to navigate to for GDI check
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
 * Guest payment flow - returns the card save choice page URL
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

  // Step 3: Get redirect URL
  const paymentMethodId = await getAllPaymentMethods(sessionToken, 'CARDS');
  const redirectUrl = await getGuestCardRedirectUrl(sessionToken, paymentMethodId, rptId, amount);

  console.log('✓ Redirect URL generated - ready to navigate to choice page');
  return redirectUrl;
};