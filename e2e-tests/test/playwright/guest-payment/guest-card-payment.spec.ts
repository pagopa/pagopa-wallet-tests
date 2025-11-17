import { test, expect } from '@playwright/test';
import {
  startGuestSession,
  getPaymentInfo,
  startGuestTransaction,
  calculateGuestFees,
  createGuestAuthorizationRequest,
  generateRandomRptId,
  getGuestCardRedirectUrl,
} from '../utils/guestPaymentHelpers';
import { getAllPaymentMethods } from '../utils/paymentMethodHelpers';
import {
  registerOutcomeInterceptor,
  registerPageOutcomeTracker,
  clearInterceptedOutcomes,
  getOutcomeUrlForTest,
} from '../utils/outcomeInterceptor';
import {
  fillCardDataForm,
  getOutcome,
  getOrderId,
  getTransactionId,
  pollForCondition,
} from '../utils/helpers';

const CARDS_WALLET_PAYMENT_PSP_ID = String(process.env.CARDS_WALLET_PAYMENT_PSP_ID);
const PAYMENT_USER_ID = String(process.env.PAYMENT_USER_ID);

// test card to get outcome 0
const GUEST_CARD_DATA = {
  number: '4000000000000101',
  expirationDate: '1230',
  ccv: '123',
  holderName: 'Test Test',
};

test.describe.only('Guest Card Payment - Card Save Choice', () => {
  test.beforeEach(async () => {
    clearInterceptedOutcomes();
  });

  test('should complete guest card payment flow and reach outcome=0', async ({ page }) => {
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

    const noSaveCardOption = page.getByTestId('noSaveRedirectBtn');
    await expect(noSaveCardOption).toBeVisible({ timeout: 10000 });
    await noSaveCardOption.click();
    console.log('Guest payment chosen');

    await page.waitForURL('**/inserimento-carta**', { timeout: 10000 });

    console.log('=== Phase 3: Filling card data ===');
    await fillCardDataForm(page, GUEST_CARD_DATA);

    console.log('=== Phase 4: Waiting for orderId from outcome URL ===');
    const outcomeUrlAvailable = await pollForCondition(
      () => {
        const url = getOutcomeUrlForTest(testId);
        return url !== undefined && url.includes('orderId=');
      },
      30000,
      1000
    );

    if (!outcomeUrlAvailable) {
      throw new Error('Timeout waiting for outcome URL with orderId');
    }

    const outcomeUrl = getOutcomeUrlForTest(testId);
    console.log('✓ MAGIC URL #1 (after card data submission) intercepted');

    const orderId = getOrderId(outcomeUrl);
    if (!orderId) {
      throw new Error('Failed to extract orderId from outcome URL');
    }

    console.log('=== Phase 5: Creating transaction and authorization ===');
    const { transactionId } = await startGuestTransaction(sessionToken, rptId, amount);

    const { pspId, fee } = await calculateGuestFees(
      sessionToken,
      paymentMethodId,
      orderId,
      amount,
      CARDS_WALLET_PAYMENT_PSP_ID
    );

    const authUrl = await createGuestAuthorizationRequest(
      sessionToken,
      transactionId,
      orderId,
      paymentMethodId,
      amount,
      fee,
      pspId
    );

    console.log('=== Phase 6: GDI check and final outcome ===');
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
      throw new Error('Timeout waiting for final outcome URL');
    }

    const finalOutcomeUrl = getOutcomeUrlForTest(testId);
    console.log('✓ MAGIC URL #2 (after clicking "Continua sull\'app IO") intercepted');

    const finalOutcome = getOutcome(finalOutcomeUrl);
    expect(finalOutcome).toBe(0);
    console.log('✓ Payment successful: outcome=0');

    const finalTransactionId = getTransactionId(finalOutcomeUrl);
    console.log(`✓ Transaction ID: ${finalTransactionId}`);

    console.log('=== Test completed successfully! ===');
  });
});