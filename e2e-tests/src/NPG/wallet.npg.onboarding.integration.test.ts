import { fillCardDataForm, retrieveValidRedirectUrl } from './helper';

describe('wallet payment npg activation tests', () => {
  /**
   * Test input and configuration
   */
  const WALLET_HOST = String(process.env.WALLET_HOST);
  const PAYMENT_METHOD_ID = String(process.env.PAYMENT_METHOD_ID);
  const VALID_CARD_DATA = {
    number: String(process.env.CARD_NUMBER_XPAY),
    expirationDate: String(process.env.CARD_EXPIRATION_DATE_XPAY),
    ccv: String(process.env.CARD_CCV_XPAY),
    holderName: String(process.env.CARD_HOLDER_NAME_XPAY),
  };

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
    /*
     * 1. Payment with valid notice code
     */
    const redirectUrl = await retrieveValidRedirectUrl(WALLET_HOST, PAYMENT_METHOD_ID);
    await page.goto(redirectUrl);
    await fillCardDataForm(VALID_CARD_DATA);

    expect(page.url()).toContain('gdi-check');
    await page.waitForNavigation();
    expect(page.url()).toContain('outcome=0');
  });
});
