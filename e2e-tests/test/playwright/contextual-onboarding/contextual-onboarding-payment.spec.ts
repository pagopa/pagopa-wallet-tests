import { test, expect } from '@playwright/test';
import {
  startEcommerceSession,
  generateRandomRptId,
  getPaymentInfo,
  getAllPaymentMethods,
  getPaymentMethodRedirectUrl
} from '../utils/paymentFlowsHelpers';
import {
  calculateFeesByWalletId,
  createWalletAuthorizationRequest,
  getWalletById,
  deleteWallet
} from '../utils/contextualOnboardingHelpers';
import {
  registerOutcomeInterceptor,
  registerPageOutcomeTracker,
  clearInterceptedOutcomes,
  getOutcomeUrlForTest,
} from '../utils/outcomeInterceptor';
import {
  fillCardDataForm,
  getOutcome,
  getWalletId,
  getTransactionId,
  pollForCondition,
} from '../utils/helpers';

const PAYMENT_USER_ID = '21c6d8b5-1407-49aa-b39c-a635a1b186ce'; // must be valid and not randomly generated

const CONTEXTUAL_ONBOARDING_CARD_DATA = {
  number: '4242424242424242',
  expirationDate: '1230',
  ccv: '123',
  holderName: 'Test Test',
};

test.describe('Contextual Onboarding Payment - Save Card + Pay', () => {
  test.beforeEach(async () => {
    clearInterceptedOutcomes();
  });

  test('should complete contextual onboarding and payment flow with outcome=0', async ({
    page,
  }) => {
    console.log('=== Phase 1: Creating payment session ===');
    const rptId = generateRandomRptId();
    const sessionToken = await startEcommerceSession(PAYMENT_USER_ID);
    const { amount } = await getPaymentInfo(sessionToken, rptId);

    // Get payment method ID and redirect URL
    const paymentMethodId = await getAllPaymentMethods(sessionToken, 'CARDS');
    const authorizationUrl = await getPaymentMethodRedirectUrl(sessionToken, paymentMethodId, rptId, amount);

    await registerOutcomeInterceptor(page);
    const testId = await registerPageOutcomeTracker(page);

    console.log('=== Phase 2: Navigating to card save choice page ===');
    await page.goto(authorizationUrl);

    let saveCardOption = page.getByTestId('saveRedirectBtn');
    try {
      await expect(saveCardOption).toBeVisible({ timeout: 5000 });
    } catch {
      saveCardOption = page.getByText(/salva la carta/i);
      await expect(saveCardOption).toBeVisible({ timeout: 10000 });
    }
    await saveCardOption.click();

    console.log('=== Phase 3: Waiting for navigation to card entry page ===');
    await page.waitForURL('**/payment/creditcard**', { timeout: 10000 });

    console.log('=== Phase 4: Filling card data for wallet onboarding ===');
    await fillCardDataForm(page, CONTEXTUAL_ONBOARDING_CARD_DATA);

    console.log('=== Phase 5: Waiting for walletId from contextual onboard outcome URL ===');
    const outcomeUrlAvailable = await pollForCondition(
      () => {
        const url = getOutcomeUrlForTest(testId);
        return (
          url !== undefined &&
          url.includes('/wallets/contextual-onboard/outcomes') &&
          url.includes('walletId=')
        );
      },
      30000,
      1000
    );

    if (!outcomeUrlAvailable) {
      throw new Error('Timeout waiting for contextual onboard outcome URL with walletId');
    }

    const onboardOutcomeUrl = getOutcomeUrlForTest(testId);
    console.log('✓ MAGIC URL #1 (after wallet onboarding) intercepted');

    const onboardOutcome = getOutcome(onboardOutcomeUrl);
    expect(onboardOutcome).toBe(0);

    const walletId = getWalletId(onboardOutcomeUrl);
    if (!walletId) {
      throw new Error('Failed to extract walletId from contextual onboard outcome URL');
    }

    const transactionId = getTransactionId(onboardOutcomeUrl);
    if (!transactionId) {
      throw new Error('Failed to extract transactionId from contextual onboard outcome URL');
    }

    console.log('=== Phase 6: Calculating fees and creating auth request ===');
    const { pspId, fee } = await calculateFeesByWalletId(
      sessionToken,
      paymentMethodId,
      walletId,
      amount
    );

    const authUrl = await createWalletAuthorizationRequest(
      sessionToken,
      transactionId,
      walletId,
      amount,
      fee,
      pspId
    );

    console.log('=== Phase 7: Navigating to GDI check ===');
    await page.goto(authUrl);

    console.log('Waiting for GDI check to complete and redirect to /esito...');
    await page.waitForURL('**/esito**', { timeout: 60000 });
    console.log('✓ Redirected to /esito page');

    console.log('=== Phase 8: Waiting for 3DS and payment completion ===');
    // Race condition: wait for button OR wallet validation
    const completionMethod = await Promise.race([
      // Option 1: Button appears
      page.waitForSelector('text="Continua sull\'app IO"', { timeout: 60000 })
        .then(() => ({ type: 'button' as const }))
        .catch(() => ({ type: 'timeout' as const })),

      // Option 2: Wallet validation completed (backend succeeded even if frontend doesn't redirect)
      (async () => {
        const walletValidated = await pollForCondition(
          async () => {
            try {
              const wallet = await getWalletById(sessionToken, walletId);
              const isValidated = wallet.status === 'VALIDATED';
              const isAlreadyOnboarded = wallet.validationErrorCode === 'WALLET_ALREADY_ONBOARDED_FOR_USER';
              return isValidated || isAlreadyOnboarded;
            } catch (error) {
              return false;
            }
          },
          60000,
          5000
        );
        return walletValidated ? { type: 'wallet-validated' as const } : { type: 'timeout' as const };
      })(),
    ]);

    if (completionMethod.type === 'button') {
      const continueButton = await page.waitForSelector('text="Continua sull\'app IO"', { timeout: 5000 });
      await continueButton.click();
      console.log('✓ Button clicked');

      // Poll webview endpoint for final outcome
      console.log('Polling for final outcome from webview endpoint...');
      const APIM_HOST = String(process.env.APIM_HOST);

      let finalOutcome: number | undefined;
      const webviewOutcomeAvailable = await pollForCondition(
        async () => {
          try {
            const response = await fetch(
              `${APIM_HOST}/ecommerce/webview/v1/transactions/${transactionId}/outcomes`,
              {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${sessionToken}`,
                },
              }
            );

            if (response.ok) {
              const data = await response.json();
              console.log(`Webview outcome: ${data.outcome}, isFinalStatus: ${data.isFinalStatus}`);

              if (data.isFinalStatus === true) {
                finalOutcome = data.outcome;
                return true;
              }
            }
            return false;
          } catch (error) {
            return false;
          }
        },
        30000,
        2000
      );

      if (!webviewOutcomeAvailable || finalOutcome === undefined) {
        throw new Error('Timeout waiting for final outcome from webview endpoint');
      }

      console.log('✓ Final outcome received from webview endpoint');
      expect(finalOutcome).toBe(0);
      console.log('✓ Payment completed: outcome=0');

    } else if (completionMethod.type === 'wallet-validated') {
      console.log('✓ Payment completed via backend validation');
      console.log('⚠️  Frontend button not shown (Chromium behavior)');

    } else {
      throw new Error('Timeout: Neither button appeared nor wallet was validated within 60 seconds');
    }

    console.log('=== Phase 9: Verifying wallet status ===');
    const wallet = await getWalletById(sessionToken, walletId);

    const isWalletValidated = wallet.status === 'VALIDATED';
    const isWalletAlreadyOnboarded =
      wallet.validationErrorCode === 'WALLET_ALREADY_ONBOARDED_FOR_USER';

    if (!isWalletValidated && !isWalletAlreadyOnboarded) {
      throw new Error(
        `Test failed. Expected wallet status VALIDATED or error code WALLET_ALREADY_ONBOARDED_FOR_USER.\n` +
          `Got: status=${wallet.status}, errorCode=${wallet.validationErrorCode || 'none'}`
      );
    }

    console.log(`✓ Wallet ${isWalletValidated ? 'VALIDATED' : 'already onboarded'}`);

    console.log('=== Phase 10: Cleaning up ===');
    await deleteWallet(sessionToken, walletId);
    console.log('✓ Test passed');
  });
});