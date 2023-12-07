import { fillCardDataForm, retrieveValidRedirectUrl, getOutcome } from './helper';

describe('Credit Card Wallet: onboarding with NPG', () => {
  const WALLET_HOST = String(process.env.WALLET_HOST);
  const PAYMENT_METHOD_ID = String(process.env.CREDIT_CARD_PAYMENT_METHOD_ID);
  /**
   * Increase default test timeout (60000ms)
   * to support entire payment flow
   */
  const timeout = 30_000;
  jest.setTimeout(timeout);
  jest.retryTimes(3);
  page.setDefaultNavigationTimeout(timeout);
  page.setDefaultTimeout(timeout);

  afterEach(async () => {
    await jestPuppeteer.resetPage();
  });

  it('should redirect with outcome 0 (success) success using an valid visa card', async () => {
    /*
     * 1. Payment with valid notice code
     */
    const VALID_VISA_CARD_DATA = {
      number: '4012000000020089',
      expirationDate: '1226',
      ccv: '123',
      holderName: "TEST TEST",
    };
    const redirectUrl = await retrieveValidRedirectUrl(WALLET_HOST, PAYMENT_METHOD_ID);
    await page.goto(redirectUrl);
    await fillCardDataForm(VALID_VISA_CARD_DATA);
    const outocome = await getOutcome();
    expect(outocome).toBe(0);
  });

  it('should redirect with outcome 1 (error) success using an invalid visa card', async () => {
    /*
     * 1. Payment with valid notice code
     */
    const VALID_VISA_CARD_DATA = {
      number: '4242424242424242',
      expirationDate: '1230',
      ccv: '123',
      holderName: "TEST TEST",
    };
    const redirectUrl = await retrieveValidRedirectUrl(WALLET_HOST, PAYMENT_METHOD_ID);
    await page.goto(redirectUrl);
    await fillCardDataForm(VALID_VISA_CARD_DATA);
    const outocome = await getOutcome();
    expect(outocome).toBe(1);
  });
});
