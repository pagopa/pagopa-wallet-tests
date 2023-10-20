import { onboardCardMethodWithError4xx, onboardCardMethodWithNetworkError, retrieveValidRedirectUrl, successfullyExecutionOnboarding } from "./helper";

describe("Wallet pm onboarding tests", () => {
    /**
    * Test input and configuration
     */
    const PM_HOST = String(process.env.PM_HOST);
    const WALLET_URL = String(process.env.WALLET_URL);
    const INVALID_SECURITY_TOKEN = String(process.env.INVALID_SECUTIRY_TOKEN);
    const VALID_CARD_DATA_VPOS = {
        number: String(process.env.CARD_NUMBER_VPOS),
        expirationDate: String(process.env.CARD_EXPIRATION_DATE_VPOS),
        ccv: String(process.env.CARD_CCV_VPOS),
        holderName: String(process.env.CARD_HOLDER_NAME_VPOS)
      };
    const VALID_CARD_DATA_XPAY = {
        number: String(process.env.CARD_NUMBER_XPAY),
        expirationDate: String(process.env.CARD_EXPIRATION_DATE_XPAY),
        ccv: String(process.env.CARD_CCV_XPAY),
        holderName: String(process.env.CARD_HOLDER_NAME_XPAY)
      };
    
  /**
   * Increase default test timeout (60000ms)
   * to support entire payment flow
   */
  const timeout = 120_000
  jest.setTimeout(timeout);
  jest.retryTimes(1);
  page.setDefaultNavigationTimeout(timeout);
  page.setDefaultTimeout(timeout)
  
  it("Successfully executed onboarding for XPAY", async () => {
    const redirectUrl = await retrieveValidRedirectUrl(PM_HOST)
    await page.goto(redirectUrl);
    const resultUrl = await successfullyExecutionOnboarding(VALID_CARD_DATA_XPAY, true);
    expect(resultUrl).toContain("outcome=0");
  });

  it("Successfully executed onboarding for VPOS", async () => {
    const redirectUrl = await retrieveValidRedirectUrl(PM_HOST)
    await page.goto(redirectUrl);
    const resultUrl = await successfullyExecutionOnboarding(VALID_CARD_DATA_VPOS, false);
    expect(resultUrl).toContain("outcome=0");
  });

  it("Error 4xx while onboard card method", async () => {
    await page.goto(WALLET_URL.concat(INVALID_SECURITY_TOKEN));
    const resultUrl = await onboardCardMethodWithError4xx(VALID_CARD_DATA_XPAY);
    expect(resultUrl).toContain("outcome=1");
  });

  it("Generic error while onboard card method", async () => {
    await page.goto(WALLET_URL.concat("exampleToken"));
    const resultErrorMessage = await onboardCardMethodWithNetworkError(VALID_CARD_DATA_XPAY);
    expect(resultErrorMessage).toContain("Spiacenti, si è verificato un errore imprevisto");
  });

});