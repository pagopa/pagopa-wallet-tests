import { fillCardDataForm, retrieveValidRedirectUrl } from './helper';

/**
 * This function is usefull when we need to wait for the puppeter page instance get a certain
 * url value based on the inclusion of the urlSubstring parameter
 */
export const waitUntilUrlContains = async (urlSubstring) => 
  await page.waitForFunction(`window.location.href.includes("${urlSubstring}")`);

/**
 * This function wait for obtain the outcome parameter from the final result url
 * when the gdi check phase, the 3ds challenge and esito phase ends
 * @returns number
 */
const getOutcome = async () => {
  try {
    expect(page.url()).toContain('/gdi-check');
    await waitUntilUrlContains("/esito");
    expect(page.url()).toContain('/esito');
    await waitUntilUrlContains("/outcomes");
    const url = new URL(page.url());
    const outcome = new URLSearchParams(url.search).get("outcome");
    if( outcome === null) return -1
    return parseInt(outcome)
  } catch {
    return -1
  }
}

describe('Credit Card Wallet: onboarding with NPG', () => {
  const WALLET_HOST = String(process.env.WALLET_HOST);
  const PAYMENT_METHOD_ID = String(process.env.CREDIT_CARD_PAYMENT_METHOD_ID);
  /**
   * Increase default test timeout (60000ms)
   * to support entire payment flow
   */
  const timeout = 80_000;
  jest.setTimeout(timeout);
  jest.retryTimes(3);
  page.setDefaultNavigationTimeout(timeout);
  page.setDefaultTimeout(timeout);


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
    const outocome = await getOutcome()
    expect(outocome).toBe(0)
  });
});
