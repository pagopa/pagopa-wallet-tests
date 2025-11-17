import { test, expect } from '@playwright/test';
import {
  retrieveGuestPaymentAuthUrl,
  startGuestSession,
  getPaymentInfo,
  startGuestTransaction,
  generateRandomRptId,
} from '../utils/guestPaymentHelpers';
import { getAllPaymentMethods } from '../utils/paymentMethodHelpers';
import {
  calculateFeesByWalletId,
  createWalletAuthorizationRequest,
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

const CARDS_WALLET_PAYMENT_PSP_ID = String(process.env.CARDS_WALLET_PAYMENT_PSP_ID);
const PAYMENT_USER_ID = String(process.env.PAYMENT_USER_ID);

const GUEST_CARD_DATA = {
  number: '4000000000000101',
  expirationDate: '1230',
  ccv: '123',
  holderName: 'Test Test',
};

test.describe.only('Contextual Onboarding Payment - Save Card + Pay', () => {
  test.beforeEach(async () => {
    clearInterceptedOutcomes();
  });

  test('should complete contextual onboarding and payment flow with outcome=0', async ({
    page,
  }) => {
    console.log('=== Phase 1: Creating guest payment session ===');
    const rptId = generateRandomRptId();
    const sessionToken = await startGuestSession(PAYMENT_USER_ID);
    const { amount } = await getPaymentInfo(sessionToken, rptId);
    const authorizationUrl = await retrieveGuestPaymentAuthUrl(CARDS_WALLET_PAYMENT_PSP_ID);

    await registerOutcomeInterceptor(page);
    const testId = await registerPageOutcomeTracker(page);

    console.log('=== Phase 2: Navigating to card save choice page ===');
    await page.goto(authorizationUrl);

    const saveCardOption = page.getByTestId('saveRedirectBtn');
    await expect(saveCardOption).toBeVisible({ timeout: 10000 });
    await saveCardOption.click();

    console.log('=== Phase 3: Waiting for navigation to card entry page ===');
    await page.waitForURL('**/payment/creditcard**', { timeout: 10000 });

    console.log('=== Phase 4: Filling card data for wallet onboarding ===');
    await fillCardDataForm(page, GUEST_CARD_DATA);

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
    console.log('');
    console.log('🔗 MAGIC URL #1 (after wallet onboarding):');
    console.log(`   ${onboardOutcomeUrl}`);
    console.log('');

    const onboardOutcome = getOutcome(onboardOutcomeUrl);
    expect(onboardOutcome).toBe(0);
    console.log('✓ Wallet onboarding successful: outcome=0');

    const walletId = getWalletId(onboardOutcomeUrl);
    if (!walletId) {
      throw new Error('Failed to extract walletId from contextual onboard outcome URL');
    }
    console.log(`✓ WalletId extracted: ${walletId}`);

    console.log('=== Phase 6: Creating transaction for payment ===');
    const { transactionId } = await startGuestTransaction(sessionToken, rptId, amount);

    // Get cards payment method id
    const paymentMethodId = await getAllPaymentMethods(sessionToken, 'CARDS');

    const { pspId, fee } = await calculateFeesByWalletId(
      sessionToken,
      paymentMethodId,
      walletId,
      amount,
      CARDS_WALLET_PAYMENT_PSP_ID
    );

    const authUrl = await createWalletAuthorizationRequest(
      sessionToken,
      transactionId,
      walletId,
      amount,
      fee,
      pspId
    );

    console.log('=== Phase 7: GDI check and final payment outcome ===');
    await page.goto(authUrl);

    console.log('Waiting for GDI check to complete...');
    const continueButton = await page.waitForSelector('text="Continua sull\'app IO"', {
      timeout: 60000,
    });

    await continueButton.click();

    const finalOutcomeAvailable = await pollForCondition(
      () => {
        const url = getOutcomeUrlForTest(testId);
        return url !== undefined && url.includes('/transactions/') && url.includes('/outcomes');
      },
      20000,
      1000
    );

    if (!finalOutcomeAvailable) {
      throw new Error('Timeout waiting for final payment outcome URL');
    }

    const finalOutcomeUrl = getOutcomeUrlForTest(testId);
    console.log('');
    console.log('🔗 MAGIC URL #2 (after clicking "Continua sull\'app IO"):');
    console.log(`   ${finalOutcomeUrl}`);
    console.log('');

    const finalOutcome = getOutcome(finalOutcomeUrl);
    expect(finalOutcome).toBe(0);
    console.log('✓ Payment successful: outcome=0');

    const finalTransactionId = getTransactionId(finalOutcomeUrl);
    console.log(`✓ Transaction ID: ${finalTransactionId}`);

    console.log('=== Contextual onboarding + payment completed successfully! ===');
  });
});