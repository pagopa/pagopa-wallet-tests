import { fillCardDataForm, retrieveValidRedirectUrl, getOutcome, waitUntilUrlContains, clickPaypalButton, checkAndClickPaypalFirstPsps, fillPaypalAuth } from './helper';

describe('Credit Card Wallet: onboarding with NPG', () => {
  const WALLET_HOST = String(process.env.WALLET_HOST);
  const PAYMENT_METHOD_ID = String(process.env.CREDIT_CARD_PAYMENT_METHOD_ID);
  /**
   * Increase default test timeout (60000ms)
   * to support entire payment flow
   */
  const timeout = 40_000;
  jest.setTimeout(timeout);
  jest.retryTimes(3);
  page.setDefaultNavigationTimeout(timeout);
  page.setDefaultTimeout(timeout);

  afterEach(async () => {
    await jestPuppeteer.resetPage();
  });

  it.skip('should redirect with outcome 0 (success) success using an valid visa card', async () => {
    const VALID_VISA_CARD_DATA = {
      number: '4012000000020089',
      expirationDate: '1226',
      ccv: '123',
      holderName: "TEST TEST",
    };
    const redirectUrl = await retrieveValidRedirectUrl(WALLET_HOST, PAYMENT_METHOD_ID);
    let url;
    await page.goto(redirectUrl);
    page.on('request', interceptedRequest => {
      if (interceptedRequest.isInterceptResolutionHandled()) return;
        if (
          interceptedRequest.url().indexOf('payment-wallet-outcomes') > 0
        ) {
          url = interceptedRequest.url();
        } 
        interceptedRequest.continue();
      });
    await page.setRequestInterception(true);

    await fillCardDataForm(VALID_VISA_CARD_DATA);
    expect(page.url()).toContain('/gdi-check');
    await waitUntilUrlContains("/esito");
    expect(page.url()).toContain('/esito');
    await new Promise(r => setTimeout(r, 4000));
    const outcome = await getOutcome(url);
    expect(outcome).toBe(0);
  });

  it.skip('should redirect with outcome 15 (already onboarded) using an valid visa card already used', async () => {
    const VALID_VISA_CARD_DATA = {
      number: '4012000000020089',
      expirationDate: '1226',
      ccv: '123',
      holderName: "TEST TEST",
    };
    const redirectUrl = await retrieveValidRedirectUrl(WALLET_HOST, PAYMENT_METHOD_ID);
    let url;
    await page.goto(redirectUrl);
    page.on('request', interceptedRequest => {
      if (interceptedRequest.isInterceptResolutionHandled()) return;
        if (
          interceptedRequest.url().indexOf('payment-wallet-outcomes') > 0
        ) {
          url = interceptedRequest.url();
        } 
        interceptedRequest.continue();
      });
    await page.setRequestInterception(true);

    await fillCardDataForm(VALID_VISA_CARD_DATA);
    expect(page.url()).toContain('/gdi-check');
    await waitUntilUrlContains("/esito");
    expect(page.url()).toContain('/esito');
    await new Promise(r => setTimeout(r, 4000));
    const outcome = await getOutcome(url);
    expect(outcome).toBe(15);
  });

  it.skip('should redirect with outcome not equal to 0 (2) using a not valid visa card', async () => {
    const NOT_VALID_VISA_CARD_DATA = {
      number: '4242424242424242',
      expirationDate: '1230',
      ccv: '123',
      holderName: "TEST TEST",
    };
    const redirectUrl = await retrieveValidRedirectUrl(WALLET_HOST, PAYMENT_METHOD_ID);
    await page.goto(redirectUrl);
    let url;
    page.on('request', interceptedRequest => {
      if (interceptedRequest.isInterceptResolutionHandled()) return;
        if (
          interceptedRequest.url().indexOf('payment-wallet-outcomes') > 0
        ) {
          url = interceptedRequest.url();
        } 
        interceptedRequest.continue();
      });
    await page.setRequestInterception(true);
    await fillCardDataForm(NOT_VALID_VISA_CARD_DATA);
    expect(page.url()).toContain('/gdi-check');
    await waitUntilUrlContains("/esito");
    expect(page.url()).toContain('/esito');
    await new Promise(r => setTimeout(r, 4000));
    const outcome = await getOutcome(url);
    expect(outcome).toBe(2);
  });
});


describe('Paypal Wallet: onboarding with NPG', () => {
  const WALLET_HOST = String(process.env.WALLET_HOST);
  const PAYMENT_METHOD_ID = String(process.env.PAYMENT_METHOD_ID_PAYPAL);
  /**
   * Increase default test timeout (60000ms)
   * to support entire payment flow
   */
  const timeout = 10_000;
  jest.setTimeout(timeout);
  jest.retryTimes(1);
  page.setDefaultNavigationTimeout(timeout);
  page.setDefaultTimeout(timeout);

  afterEach(async () => {
    await jestPuppeteer.resetPage();
  });

  it('should redirect with outcome 0 (success) success using paypal account', async () => {
    const PAYPAL_ACCOUNT_DATA = {
      username: 'buyerpaypal@icbpi.it',
      password: 'buyerpaypal'
    };
    const redirectUrl = await retrieveValidRedirectUrl(WALLET_HOST, PAYMENT_METHOD_ID);
    let url;
    await page.goto(redirectUrl);
    await clickPaypalButton();
    await checkAndClickPaypalFirstPsps();
    await page.waitForNavigation();
    await waitUntilUrlContains("https://stg-ta.nexigroup.com/monetaweb/psp/paypal");
    const paypalLoginButton = await page.waitForSelector('#buttons-container', {timeout: 5000});
    await page.click(paypalLoginButton);
    await page.waitForNavigation();
    await fillPaypalAuth(PAYPAL_ACCOUNT_DATA)
    
    /*page.on('request', interceptedRequest => {
      if (interceptedRequest.isInterceptResolutionHandled()) return;
        if (
          interceptedRequest.url().indexOf('payment-wallet-outcomes') > 0
        ) {
          url = interceptedRequest.url();
        } 
        interceptedRequest.continue();
      });
    await page.setRequestInterception(true);*/
    expect(page.url()).toContain('/gdi-check');
    await waitUntilUrlContains("/esito");
    expect(page.url()).toContain('/esito');
    await new Promise(r => setTimeout(r, 65000));
    const outcome = await getOutcome(url);
    expect(outcome).toBe(0);
  });

});
