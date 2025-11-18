/**
 * Shared helper functions for payment methods
 */

const WALLET_HOST = String(process.env.WALLET_HOST);

/**
 * Payment Flow - Start new session
 */
export const startEcommerceSession = async (userId: string = ''): Promise<string> => {
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
 * Generates a random RPTID for test payments
 */
export const generateRandomRptId = (): string => {
  const randomPart = Math.floor(Math.random() * (999999999999 - 0 + 1) + 0)
    .toString()
    .padStart(12, '0');
  return `77777777777302001${randomPart}`;
};

/**
 * Guest Payment Flow - Get payment info by rptId
 *
 * @param sessionToken - Session token from startEcommerceSession
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
 * Payment Flow - Get redirect URL for card save choice page
 *
 * @param sessionToken - Session token from startEcommerceSession
 * @param paymentMethodId - Payment method ID from getAllPaymentMethods
 * @param rptId - Random RPT ID generated for the test
 * @param amount - Payment amount in cents
 * @returns Redirect URL to the card save choice page
 */
export const getPaymentMethodRedirectUrl = async (
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
 * Get all payment methods and filter by name
 *
 * Retrieves all available payment methods and filters by name to get the payment method ID.
 * This makes tests environment-agnostic (works across DEV/UAT even if IDs differ).
 *
 * Used by both:
 * - Guest card payment flow
 * - Contextual onboarding payment flow
 *
 * @param sessionToken - Session token from startEcommerceSession
 * @param paymentMethodName - Name of the payment method to retrieve (e.g., "CARDS", "APPLEPAY")
 * @returns Payment method ID for the specified name
 */
export const getAllPaymentMethods = async (
  sessionToken: string,
  paymentMethodName: string = 'CARDS'
): Promise<string> => {
  const url = `${WALLET_HOST}/ecommerce/io/v2/payment-methods`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    },
  });

  if (response.status !== 200) {
    throw new Error(
      `Failed to get payment methods: ${response.status} - ${JSON.stringify(
        await response.json()
      )}`
    );
  }

  const data = await response.json();
  const paymentMethods = data.paymentMethods || [];

  const targetPaymentMethod = paymentMethods.find(
    (pm: any) => pm.name === paymentMethodName
  );

  if (!targetPaymentMethod) {
    throw new Error(
      `Payment method '${paymentMethodName}' not found. Available: ${paymentMethods
        .map((pm: any) => pm.name)
        .join(', ')}`
    );
  }

  console.log(`✓ Payment method ID retrieved (${paymentMethodName})`);
  return targetPaymentMethod.id;
};