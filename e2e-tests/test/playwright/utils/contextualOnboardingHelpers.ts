/**
 * Helper functions for contextual onboarding payment flow
 *
 * Contextual onboarding = Save card + Pay in one flow
 */

const WALLET_HOST = String(process.env.WALLET_HOST);

/**
 * Contextual Onboarding Payment Flow - Step 6: Calculate fees using walletId
 *
 * This differs from guest cards payment which uses orderId.
 * For contextual onboarding, PSP is ALWAYS BNLIITRR with fee 95.
 *
 * @param sessionToken - Session token from startEcommerceSession
 * @param paymentMethodId - Payment method ID (card payment method)
 * @param walletId - Wallet ID extracted from contextual onboard outcome URL
 * @param amount - Payment amount in cents
 * @returns Object with pspId (always BNLIITRR) and fee (always 95)
 */
export const calculateFeesByWalletId = async (
  sessionToken: string,
  paymentMethodId: string,
  walletId: string,
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
 * Contextual Onboarding Payment Flow - Step 7: Create authorization request using walletId
 *
 * This differs from guest payment which uses orderId + paymentMethodId with detailType: "cards".
 * Contextual onboarding uses walletId with detailType: "wallet".
 *
 * @param sessionToken - Session token from startEcommerceSession
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

/**
 * Get wallet details by walletId to verify onboarding status
 *
 * @param sessionToken - Session token from startEcommerceSession
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
  validationErrorCode?: string;
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
  console.log(
    `✓ Wallet retrieved: ${walletId}, status=${wallet.status}, validationErrorCode=${wallet.validationErrorCode || 'none'}`
  );
  return wallet;
};

/**
 * Delete a wallet by its ID
 * Useful for cleaning up test wallets after onboarding tests
 *
 * @param sessionToken - Session token from startEcommerceSession
 * @param walletId - Wallet ID to delete
 */
export const deleteWallet = async (sessionToken: string, walletId: string): Promise<void> => {
  const url = `${WALLET_HOST}/io-payment-wallet/v1/wallets/${walletId}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    },
  });

  if (response.status !== 204) {
    throw new Error(
      `Failed to delete wallet: ${response.status} - ${JSON.stringify(await response.json())}`
    );
  }

  console.log(`✓ Wallet deleted: ${walletId}`);
};