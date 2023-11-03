import { fillCardDataForm } from './helper';

describe('wallet payment npg activation tests', () => {
  /**
   * Test input and configuration
   */
  const NPG_WALLET_URL = String(process.env.NPG_WALLET_URL);
  const VALID_CARD_DATA = {
    number: String(process.env.CARD_NUMBER_XPAY),
    expirationDate: String(process.env.CARD_EXPIRATION_DATE_XPAY),
    ccv: String(process.env.CARD_CCV_XPAY),
    holderName: String(process.env.CARD_HOLDER_NAME_XPAY),
  };

  const sessionToken = 'exampleToken';
  const walletId = '123';
  const NPG_VALID_URL = `${NPG_WALLET_URL}#sessionToken=${sessionToken}&walletId=${walletId}`;

  /**
   * Increase default test timeout (60000ms)
   * to support entire payment flow
   */
  const timeout = 80_000;
  jest.setTimeout(timeout);
  jest.retryTimes(3);
  page.setDefaultNavigationTimeout(timeout);
  page.setDefaultTimeout(timeout);

  beforeEach(async () => {
    await page.goto(NPG_VALID_URL);
  });

  it('It Should redirect with outcome 0 on success', async () => {
    /*
     * 1. Payment with valid notice code
     */
    await fillCardDataForm(VALID_CARD_DATA);

    expect(page.url()).toContain('gdi-check');
    await page.waitForNavigation();
    expect(page.url()).toContain('outcome=0');
  });
});
