import {retrievePaymentRedirectUrl} from "./helper";

const WALLET_HOST = String(process.env.WALLET_HOST);
const USER_WALLET_TOKEN = String(process.env.USER_WALLET_TOKEN);

describe('wallet npg payment check tests', () => {
  /**
   * Increase default test timeout (60000ms)
   * to support entire payment flow
   */
  const timeout = 320_000;
  jest.setTimeout(timeout);
  jest.retryTimes(3);
  page.setDefaultNavigationTimeout(timeout);
  page.setDefaultTimeout(timeout);

  it.skip('It Should redirect with outcome 0 on success', async () => {

    let url;
    const authorizationUrl = await retrievePaymentRedirectUrl(WALLET_HOST, USER_WALLET_TOKEN);
    page.on('request', interceptedRequest => {
      if (interceptedRequest.isInterceptResolutionHandled()) return;
        if (
          interceptedRequest.url().indexOf('io-outcomes') > 0
        ) {
          console.debug("outcome url checking")
          url = interceptedRequest.url();
          const outcome = new URLSearchParams(url.split("?")[1]).get("outcome");
          expect(outcome).toBe(0);
        }
        interceptedRequest.continue();
      });
    await page.setRequestInterception(true);
    await page.goto(authorizationUrl);
    await page.waitForNavigation();
    expect(page.url()).toContain('esito');
    expect(page.url()).toContain('transactionId');
    expect(page.url()).toContain('clientId=IO');
    await new Promise(r => setTimeout(r, 60000));
  });
});
