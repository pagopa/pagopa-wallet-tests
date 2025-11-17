/**
 * Helper functions for contextual onboarding payment flow
 *
 * Contextual onboarding = Save card + Pay in one flow
 */

const WALLET_HOST = String(process.env.WALLET_HOST);

/**
 * Get wallet details by walletId to verify onboarding status
 *
 * @param sessionToken - Session token from startGuestSession
 * @param walletId - Wallet ID to check
 * @returns Wallet object with status, paymentMethodId, and details
 */
export const getWalletById = async (
  sessionToken: string,
  walletId: string
): Promise<{
  walletId: string;
  status: string;
  paymentMethodId: string;
  userId: string;
  details: any;
}> => {
  const url = `${WALLET_HOST}/io-payment-wallet/v1/wallets/${walletId}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    },
  });

  if (response.status !== 200) {
    throw new Error(
      `Failed to get wallet by ID: ${response.status} - ${JSON.stringify(await response.json())}`
    );
  }

  const wallet = await response.json();
  console.log(`✓ Wallet retrieved: ${walletId}, status=${wallet.status}`);
  return wallet;
};

/**
 * Contextual Onboarding Payment Flow - Step 6: Calculate fees using walletId
 *
 * This differs from guest cards payment which uses orderId.
 *
 * @param sessionToken - Session token from startGuestSession
 * @param paymentMethodId - Payment method ID (card payment method)
 * @param walletId - Wallet ID extracted from contextual onboard outcome URL
 * @param amount - Payment amount in cents
 * @param targetPspId - Optional target PSP ID to filter bundles
 * @returns Object with pspId and fee
 */
export const calculateFeesByWalletId = async (
  sessionToken: string,
  paymentMethodId: string,
  walletId: string,
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
      walletId: walletId, // this flow (contextual onboarding) uses walletId instead of orderId
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
      `Failed to calculate fees by walletId: ${response.status} - ${JSON.stringify(
        await response.json()
      )}`
    );
  }

  const data = await response.json();
  console.log(`✓ Fees calculated by walletId: ${data.bundles?.length || 0} bundles found`);

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
 * Contextual Onboarding Payment Flow - Step 7: Create authorization request using walletId
 *
 * This differs from guest payment which uses orderId + paymentMethodId with detailType: "cards".
 * Contextual onboarding uses walletId with detailType: "wallet".
 *
 * @param sessionToken - Session token from startGuestSession
 * @param transactionId - Transaction ID from startGuestTransaction
 * @param walletId - Wallet ID from contextual onboard outcome URL
 * @param amount - Payment amount in cents
 * @param fee - Fee from calculateFeesByWalletId
 * @param pspId - PSP ID from calculateFeesByWalletId
 * @returns Authorization URL to navigate to for GDI check
 */
export const createWalletAuthorizationRequest = async (
  sessionToken: string,
  transactionId: string,
  walletId: string,
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
        detailType: 'wallet', // "wallet" instead of "cards"
        walletId: walletId, // walletId instead of orderId
      },
    }),
  });

  if (response.status !== 200) {
    throw new Error(
      `Failed to create wallet auth request: ${response.status} - ${JSON.stringify(
        await response.json()
      )}`
    );
  }

  const data = await response.json();
  console.log('✓ Wallet authorization URL created');
  return data.authorizationUrl;
};