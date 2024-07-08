import { retrieveValidRedirectUrl, successfullyExecutionOnboarding } from "./helper";

describe("Wallet pm onboarding tests", () => {
    /**
    * Test input and configuration
     */
    const WALLET_HOST = String(process.env.WALLET_HOST);
    const CREDIT_CARD_PAYMENT_METHOD_ID = String(process.env.CREDIT_CARD_PAYMENT_METHOD_ID);
    const USER_WALLET_TOKEN = String(process.env.USER_WALLET_TOKEN);
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
    const redirectUrl = await retrieveValidRedirectUrl(WALLET_HOST, USER_WALLET_TOKEN, CREDIT_CARD_PAYMENT_METHOD_ID)
    await page.goto(redirectUrl);
    const resultUrl = await successfullyExecutionOnboarding(VALID_CARD_DATA_XPAY, true);
    expect(resultUrl).toContain("outcome=0");
  });

  it("Successfully executed onboarding for VPOS", async () => {
    const redirectUrl = await retrieveValidRedirectUrl(WALLET_HOST, USER_WALLET_TOKEN, CREDIT_CARD_PAYMENT_METHOD_ID)
    await page.goto(redirectUrl);
    const resultUrl = await successfullyExecutionOnboarding(VALID_CARD_DATA_VPOS, false);
    expect(resultUrl).toContain("outcome=0");
  });

});