import {getOutcome, retrievePaymentRedirectUrl,waitUntilUrlContains} from "./helper";

const WALLET_HOST = String(process.env.WALLET_HOST);
const USER_WALLET_TOKEN = String(process.env.USER_WALLET_TOKEN);

describe('wallet npg payment', () => {
  /**
   * Increase default test timeout (60000ms)
   * to support entire payment flow
   */
  const timeout = 360_000;
  jest.setTimeout(timeout);
  jest.retryTimes(3);
  page.setDefaultNavigationTimeout(timeout);
  page.setDefaultTimeout(timeout);

  it('Onboarded card payment should redirect with outcome 0 on success', async () => {

    let url;
    const authorizationUrl = await retrievePaymentRedirectUrl(WALLET_HOST, USER_WALLET_TOKEN, "CARDS");
    page.on('request', interceptedRequest => {
      if (interceptedRequest.isInterceptResolutionHandled()) return;
        if (
          interceptedRequest.url().indexOf('io-outcomes') > 0
        ) {
          url = interceptedRequest.url();
        }
        interceptedRequest.continue();
      });
    await page.setRequestInterception(true);
    await page.goto(authorizationUrl);
    await page.waitForNavigation();
    await waitUntilUrlContains("/esito");
    expect(page.url()).toContain('esito');
    expect(page.url()).toContain('transactionId');
    expect(page.url()).toContain('clientId=IO');
    const maxTimeToWait = 65000;
    const pollingResultUrlStartTime = Date.now();
    while(url===undefined && Date.now()-pollingResultUrlStartTime < maxTimeToWait){
      console.log(`Waiting for outcome URL...`);
      await new Promise(r => setTimeout(r, 1000));
    }
    console.log(`Captured redirection url: [${url}]`)
    const outcome = await getOutcome(url)
    expect(outcome).toBe(0);
  });

  it('Onboarded paypal payment should redirect with outcome 0 on success', async () => {

    let url;
    const authorizationUrl = await retrievePaymentRedirectUrl(WALLET_HOST, USER_WALLET_TOKEN, "PAYPAL");
    page.on('request', interceptedRequest => {
      if (interceptedRequest.isInterceptResolutionHandled()) return;
        if (
          interceptedRequest.url().indexOf('io-outcomes') > 0
        ) {
          url = interceptedRequest.url();
        }
        interceptedRequest.continue();
      });
    await page.setRequestInterception(true);
    await page.goto(authorizationUrl);
    await page.waitForNavigation();
    await waitUntilUrlContains("/esito");
    expect(page.url()).toContain('esito');
    expect(page.url()).toContain('transactionId');
    expect(page.url()).toContain('clientId=IO');
    const maxTimeToWait = 65000;
    const pollingResultUrlStartTime = Date.now();
    while(url===undefined && Date.now()-pollingResultUrlStartTime < maxTimeToWait){
      console.log(`Waiting for outcome URL...`);
      await new Promise(r => setTimeout(r, 1000));
    }
    console.log(`Captured redirection url: [${url}]`)
    const outcome = await getOutcome(url)
    expect(outcome).toBe(0);
  });
});


