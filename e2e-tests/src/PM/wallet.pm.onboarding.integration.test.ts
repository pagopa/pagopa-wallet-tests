import { onboardCardMethodWithError4xx, onboardCardMethodWithNetworkError } from "./helper";

describe("Wallet pm onboarding tests", () => {
    /**
    * Test input and configuration
     */
    const WALLET_URL = String(process.env.WALLET_URL);
    const INVALID_SECURITY_TOKEN = String(process.env.INVALID_SECUTIRY_TOKEN);
    const VALID_SECURITY_TOKEN = "validToken"
    const VALID_CARD_DATA = {
        number: String(process.env.CARD_NUMBER),
        expirationDate: String(process.env.CARD_EXPIRATION_DATE),
        ccv: String(process.env.CARD_CCV),
        holderName: String(process.env.CARD_HOLDER_NAME)
      };
    
  /**
   * Increase default test timeout (60000ms)
   * to support entire payment flow
   */
  const timeout = 60_000
  jest.setTimeout(timeout);
  jest.retryTimes(1);
  page.setDefaultNavigationTimeout(timeout);
  page.setDefaultTimeout(timeout)
  
  it("Error 4xx while onboard card method", async () => {
    await page.goto(WALLET_URL.concat(INVALID_SECURITY_TOKEN));
    const resultUrl = await onboardCardMethodWithError4xx(VALID_CARD_DATA);
    expect(resultUrl).toContain("outcome=1");
  });

  it("Generic error while onboard card method", async () => {
    await page.goto(WALLET_URL.concat(VALID_SECURITY_TOKEN));
    const resultErrorMessage = await onboardCardMethodWithNetworkError(VALID_CARD_DATA);
    expect(resultErrorMessage).toContain("Spiacenti, si è verificato un errore imprevisto");
  });

});