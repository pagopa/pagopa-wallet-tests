import { getOutcomeUrlForTest, registerOutcomeInterceptor, registerPageOutcomeTracker } from "../utils/outcomeUrlInterceptor";
import {getOutcome, retrievePaymentRedirectUrl,waitUntilUrlContains} from "./helper";


const WALLET_HOST = String(process.env.WALLET_HOST);
const USER_WALLET_TOKEN = String(process.env.USER_WALLET_TOKEN);
const CARDS_WALLET_PAYMENT_PSP_ID = String(process.env.CARDS_WALLET_PAYMENT_PSP_ID);
const PAYPAL_WALLET_PAYMENT_PSP_ID = String(process.env.PAYPAL_WALLET_PAYMENT_PSP_ID);



describe('wallet npg payment', () => {
  /**
   * Increase default test timeout (1 minutes)
   * to support entire payment flow
   */
  const timeout = 120_000;
  jest.setTimeout(timeout);
  jest.retryTimes(1);
  page.setDefaultNavigationTimeout(timeout);
  page.setDefaultTimeout(timeout);

  it('Onboarded card payment should redirect with outcome 0 on success', async () => {

    const authorizationUrl = await retrievePaymentRedirectUrl(WALLET_HOST, USER_WALLET_TOKEN, "CARDS", CARDS_WALLET_PAYMENT_PSP_ID);
    await registerOutcomeInterceptor(page);
    const testId = await registerPageOutcomeTracker(page);
    await page.goto(authorizationUrl);
    await page.waitForNavigation();
    await waitUntilUrlContains("/esito");
    expect(page.url()).toContain('esito');
    expect(page.url()).toContain('transactionId');
    expect(page.url()).toContain('clientId=IO');
    const maxTimeToWait = 20000;
    const pollingResultUrlStartTime = Date.now();
    while(getOutcomeUrlForTest(testId)===undefined && Date.now()-pollingResultUrlStartTime < maxTimeToWait){
      console.log(`Waiting for outcome URL...`);
      await new Promise(r => setTimeout(r, 1000));
    }
    const url = getOutcomeUrlForTest(testId);
    console.log(`Captured redirection url: [${url}]`)
    const outcome = await getOutcome(url)
    expect(outcome).toBe(0);
  });

  it('Onboarded paypal payment should redirect with outcome 0 on success', async () => {

    const authorizationUrl = await retrievePaymentRedirectUrl(WALLET_HOST, USER_WALLET_TOKEN, "PAYPAL", PAYPAL_WALLET_PAYMENT_PSP_ID);
    await registerOutcomeInterceptor(page);
    const testId = await registerPageOutcomeTracker(page);
    await page.goto(authorizationUrl);
    await page.goto(authorizationUrl);
    await page.waitForNavigation();
    await waitUntilUrlContains("/esito");
    expect(page.url()).toContain('esito');
    expect(page.url()).toContain('transactionId');
    expect(page.url()).toContain('clientId=IO');
    const maxTimeToWait = 20000;
    const pollingResultUrlStartTime = Date.now();
    while(getOutcomeUrlForTest(testId)===undefined && Date.now()-pollingResultUrlStartTime < maxTimeToWait){
      console.log(`Waiting for outcome URL...`);
      await new Promise(r => setTimeout(r, 1000));
    }
    const url = getOutcomeUrlForTest(testId);
    console.log(`Captured redirection url: [${url}]`)
    const outcome = await getOutcome(url)
    expect(outcome).toBe(0);
  });
});


