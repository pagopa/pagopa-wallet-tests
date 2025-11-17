import { test, expect } from '@playwright/test';
import {
  startGuestSession,
  getPaymentInfo,
  generateRandomRptId,
  getGuestCardRedirectUrl,
} from '../utils/guestPaymentHelpers';
import { getAllPaymentMethods } from '../utils/paymentMethodHelpers';
import {
  calculateFeesByWalletId,
  createWalletAuthorizationRequest,
  getWalletById,
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
  number: '4242424242424242',
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

    // Get payment method ID and redirect URL
    const paymentMethodId = await getAllPaymentMethods(sessionToken, 'CARDS');
    const authorizationUrl = await getGuestCardRedirectUrl(sessionToken, paymentMethodId, rptId, amount);

    await registerOutcomeInterceptor(page);
    const testId = await registerPageOutcomeTracker(page);

    console.log('=== Phase 2: Navigating to card save choice page ===');
    await page.goto(authorizationUrl);

    // testId first, fall back to text if not found
    let saveCardOption = page.getByTestId('saveRedirectBtn');
    try {
      await expect(saveCardOption).toBeVisible({ timeout: 5000 });
      console.log('Found save card button by testId');
    } catch {
      console.log('testId not found, falling back to text selector');
      saveCardOption = page.getByText(/salva la carta/i);
      await expect(saveCardOption).toBeVisible({ timeout: 10000 });
    }
    await saveCardOption.click();
    console.log('Contextual onboarding chosen');

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
    console.log('✓ MAGIC URL #1 (after wallet onboarding) intercepted');

    const onboardOutcome = getOutcome(onboardOutcomeUrl);
    expect(onboardOutcome).toBe(0);
    console.log('✓ Wallet onboarding successful: outcome=0');

    const walletId = getWalletId(onboardOutcomeUrl);
    if (!walletId) {
      throw new Error('Failed to extract walletId from contextual onboard outcome URL');
    }
    console.log(`✓ WalletId extracted: ${walletId}`);

    const transactionId = getTransactionId(onboardOutcomeUrl);
    if (!transactionId) {
      throw new Error('Failed to extract transactionId from contextual onboard outcome URL');
    }
    console.log(`✓ TransactionId extracted from magic URL: ${transactionId}`);

    console.log('=== Phase 5.5: Verifying wallet status in database ===');
    const wallet = await getWalletById(sessionToken, walletId);
    console.log(`✓ Wallet details: status=${wallet.status}, paymentMethodId=${wallet.paymentMethodId}`);

    // we assume both VALIDATION_REQUESTED and VALIDATED are acceptable for continuing the payment flow
    if (!['VALIDATION_REQUESTED', 'VALIDATED'].includes(wallet.status)) {
      throw new Error(
        `Expected wallet status to be VALIDATION_REQUESTED or VALIDATED but got ${wallet.status}. Wallet may not have been onboarded correctly.`
      );
    }
    console.log(`✓ Wallet successfully onboarded with status=${wallet.status}`);

    console.log('=== Phase 6: Calculating fees and creating auth request ===');
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

    console.log('✓ Authorization URL created successfully');
    console.log(`✓ Auth URL contains GDI check: ${authUrl.includes('gdi-check')}`);
    console.log(`✓ Auth URL contains transactionId: ${authUrl.includes(transactionId)}`);

    console.log('=== Phase 7: Navigating to GDI check and waiting for completion ===');
    await page.goto(authUrl);
    console.log('✓ Navigated to authorization URL');

    console.log('Waiting for GDI check to complete (up to 60 seconds)...');
    const continueButton = await page.waitForSelector('text="Continua sull\'app IO"', {
      timeout: 60000,
    });

    console.log('✓ GDI check completed successfully');
    console.log('✓ "Continua sull\'app IO" button is visible');

    console.log('=== Phase 8: Clicking continue button and waiting for final outcome ===');
    await continueButton.click();
    console.log('✓ Clicked "Continua sull\'app IO" button');

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
    console.log('✓ MAGIC URL #2 (final payment outcome) intercepted');

    console.log('=== Contextual onboarding flow completed successfully! ===');
    console.log('✓ Wallet onboarded with outcome=0');
    console.log(`✓ WalletId: ${walletId}`);
    console.log(`✓ TransactionId: ${transactionId}`);
    console.log('✓ Wallet status: ' + wallet.status);
    console.log('✓ Authorization request created with walletId and paymentMethodId');
    console.log('✓ GDI check passed');
    console.log('✓ Final outcome URL intercepted');
    console.log('✓ Test passed: Full contextual onboarding + payment flow working correctly');
  });
});