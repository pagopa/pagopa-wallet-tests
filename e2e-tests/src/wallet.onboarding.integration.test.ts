import { onboardCardMethodWithError } from "./helper";

describe("Wallet onboarding tests", () => {
    /**
    * Test input and configuration
     */
    const WALLET_URL = String(process.env.WALLET_URL);
    const INVALID_SECURITY_TOKEN = String(process.env.INVALID_SECUTIRY_TOKEN);
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
  
  it("Generic error while onboard card method", async () => {
    /*
     * 1. Payment with valid notice code
    */
    await page.goto(WALLET_URL.concat(INVALID_SECURITY_TOKEN));
    const resultMessage = await onboardCardMethodWithError(VALID_CARD_DATA);
    expect(resultMessage).toContain("Spiacenti, si è verificato un errore imprevisto");
  });
});