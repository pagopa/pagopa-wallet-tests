import {retrievePaymentRedirectUrl} from "./helper";

const WALLET_HOST = String(process.env.WALLET_HOST);

describe.only('wallet npg payment outcome check tests', () => {
  /**
   * Increase default test timeout (60000ms)
   * to support entire payment flow
   */
  const timeout = 80_000;
  jest.setTimeout(timeout);
  jest.retryTimes(3);
  page.setDefaultNavigationTimeout(timeout);
  page.setDefaultTimeout(timeout);

  it('It Should redirect with outcome 0 on success', async () => {

    const authorizationUrl = await retrievePaymentRedirectUrl(WALLET_HOST);
    await page.goto(authorizationUrl);

    await page.waitForNavigation();
    await page.waitForNavigation();
    expect(page.url()).toContain('outcome=0');
  });
});

