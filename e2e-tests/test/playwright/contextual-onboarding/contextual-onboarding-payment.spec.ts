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
    console.log('✓ Wallet onboarding successful: outcome=0');

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

    console.log('✓ Authorization URL created successfully');
    console.log(`✓ Auth URL contains GDI check: ${authUrl.includes('gdi-check')}`);
    console.log(`✓ Auth URL contains transactionId: ${authUrl.includes(transactionId)}`);

    console.log('=== Phase 7: Navigating to GDI check and waiting for completion ===');
    await page.goto(authUrl);
    console.log('✓ Navigated to authorization URL');

    console.log('=== Phase 8: Waiting for 3DS and payment completion ===');
    console.log('Note: Flow may complete 3DS and go directly to outcome, or show GDI success page');

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

    const finalOutcome = getOutcome(finalOutcomeUrl);
    expect(finalOutcome).toBe(0);
    console.log(`✓ Final payment outcome: ${finalOutcome}`);

    const finalTransactionId = getTransactionId(finalOutcomeUrl);
    console.log(`✓ Final transaction ID: ${finalTransactionId}`);

    console.log('=== Phase 9: Verifying wallet status after payment ===');
    const wallet = await getWalletById(sessionToken, walletId);
    console.log(
      `✓ Wallet details: status=${wallet.status}, validationErrorCode=${wallet.validationErrorCode || 'none'}, paymentMethodId=${wallet.paymentMethodId}`
    );

    // Test passes if outcome=0 AND any of these conditions is true:
    // 1. Wallet status is VALIDATED
    // 2. Wallet validationErrorCode is WALLET_ALREADY_ONBOARDED_FOR_USER
    const isWalletValidated = wallet.status === 'VALIDATED';
    const isWalletAlreadyOnboarded =
      wallet.validationErrorCode === 'WALLET_ALREADY_ONBOARDED_FOR_USER';

    const testPassed = isWalletValidated || isWalletAlreadyOnboarded;

    if (!testPassed) {
      throw new Error(
        `Test failed. Expected one of the following conditions after outcome=0:\n` +
          `  - Wallet status = VALIDATED (got: ${wallet.status})\n` +
          `  - Wallet validationErrorCode = WALLET_ALREADY_ONBOARDED_FOR_USER (got: ${wallet.validationErrorCode || 'none'})\n` +
          `None of these conditions were met.`
      );
    }

    console.log('✓ Test passed! One or more success conditions met:');
    if (isWalletValidated) {
      console.log(`  ✓ Wallet status is VALIDATED`);
    }
    if (isWalletAlreadyOnboarded) {
      console.log(`  ✓ Wallet was already onboarded (validationErrorCode: WALLET_ALREADY_ONBOARDED_FOR_USER)`);
    }

    console.log('=== Phase 10: Cleaning up test wallet ===');
    await deleteWallet(sessionToken, walletId);

    console.log('=== Contextual onboarding flow completed successfully! ===');
    console.log('✓ Wallet onboarded with outcome=0');
    console.log(`✓ WalletId: ${walletId}`);
    console.log(`✓ TransactionId: ${transactionId}`);
    console.log('✓ Wallet status: ' + wallet.status);
    console.log('✓ Authorization request created with walletId and paymentMethodId');
    console.log('✓ GDI check passed');
    console.log('✓ Final payment outcome: 0');
    console.log('✓ Test wallet cleaned up');
    console.log('✓ Test passed: Full contextual onboarding + payment flow working correctly');
  });
});