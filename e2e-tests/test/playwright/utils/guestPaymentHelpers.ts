/**
 * Helper functions for guest card payment flow
 */

import { getAllPaymentMethods } from './paymentFlowsHelpers';

const WALLET_HOST = String(process.env.WALLET_HOST);

/**
 * Guest Payment Flow - Start new eCommerce transaction
 *
 * @param sessionToken - Session token from startEcommerceSession
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
 * Guest Payment Flow - Create authorization request for guest payment
 *
 * @param sessionToken - Session token from startEcommerceSession
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
  const sessionToken = await startEcommerceSession(PAYMENT_USER_ID);

  // Step 2: Get payment info
  const { amount } = await getPaymentInfo(sessionToken, rptId);

  // Step 3: Get redirect URL
  const paymentMethodId = await getAllPaymentMethods(sessionToken, 'CARDS');
  const redirectUrl = await getPaymentMethodRedirectUrl(sessionToken, paymentMethodId, rptId, amount);

  console.log('✓ Redirect URL generated - ready to navigate to choice page');
  return redirectUrl;
};