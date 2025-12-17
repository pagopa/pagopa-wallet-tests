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

    const urlParams = new URLSearchParams(authUrl);
    const webViewSessionToken = urlParams.get('sessionToken');

    console.log('=== Phase 7: Navigating to GDI check ===');
    await page.goto(authUrl);

    console.log('Waiting for GDI check to complete and redirect to /esito...');
    await page.waitForURL('**/esito**', { timeout: 60000 });
    console.log('✓ Redirected to /esito page');

    console.log('=== Phase 8: Waiting for 3DS and payment completion ===');

    // try to find and click the button (non-blocking)
    try {
      const continueButton = await page.waitForSelector('text="Continua sull\'app IO"', { timeout: 10000 });
      await continueButton.click();
      console.log('✓ Button found and clicked.');
    } catch (error) {
      console.log('Button not found or not shown in time (non-blocking, proceeding to verify outcome)');
    }

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
                'Authorization': `Bearer ${webViewSessionToken}`,
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
    console.log('✓ Payment outcome verified: outcome=0');

console.log('=== Phase 9: Verifying wallet status ===');
    let walletStatus: string | undefined;
    let walletValidationErrorCode: string | undefined;
    const walletValidated = await pollForCondition(
      async () => {
        try {
          const wallet = await getWalletById(sessionToken, walletId);
          walletStatus = wallet.status;
          walletValidationErrorCode = wallet.validationErrorCode; 
          const isValidated = walletStatus === 'VALIDATED';
          const isAlreadyOnboarded = walletValidationErrorCode === 'WALLET_ALREADY_ONBOARDED_FOR_USER';
          return isValidated || isAlreadyOnboarded;
        } catch (e) {
          return false;
        }
      },
      30000,
      5000
    );

    if (!walletValidated) {
      throw new Error(`Test failed: Wallet was not validated within the expected time. Wallet status: [${walletStatus}, validation error code: ${walletValidationErrorCode}]`);
    }
    console.log(`✓ Wallet status verified. Wallet status: [${walletStatus}, validation error code: ${walletValidationErrorCode}]`);
    console.log('=== Phase 10: Cleaning up ===');
    await deleteWallet(sessionToken, walletId);
    console.log('✓ Test passed');
  });
});