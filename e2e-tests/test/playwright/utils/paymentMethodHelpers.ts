/**
 * Shared helper functions for payment methods
 */

const WALLET_HOST = String(process.env.WALLET_HOST);

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
 * @param sessionToken - Session token from startGuestSession
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