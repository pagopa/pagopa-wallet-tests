import { getOutcomeUrlForTest, registerOutcomeInterceptor, registerPageOutcomeTracker } from '../utils/outcomeUrlInterceptor';
import { fillCardDataForm, retrieveValidRedirectUrl, getOutcome, waitUntilUrlContains, clickPaypalButton, checkAndClickPaypalFirstPsps, fillPaypalAuthAndPay, cleanWalletOnboarded, getWalletId, getWalletAlreadyOnboarded, fillPaypalAuthAndCancel } from './helper';

describe('Credit Card Wallet: onboarding with NPG', () => {
  const WALLET_HOST = String(process.env.WALLET_HOST);
  const PAYMENT_METHOD_ID = String(process.env.CREDIT_CARD_PAYMENT_METHOD_ID);
  const ONBOARDED_VALID_CARD_DATA = {
    number: '5255000260000014',
    expirationDate: '1230',
    ccv: '123',
    holderName: "TEST TEST",
  };
  /**
   * Increase default test timeout (2 minutes)
   * to support entire payment flow
   */
  const timeout = 120_000;
  jest.setTimeout(timeout);
  jest.retryTimes(1);
  page.setDefaultNavigationTimeout(timeout);
  page.setDefaultTimeout(timeout);

  afterEach(async () => {
    await jestPuppeteer.resetPage();
  });

  it('should redirect with outcome 0 (success) or 15 (already onboarded) using an valid card', async () => {
      const redirectUrl = await retrieveValidRedirectUrl(WALLET_HOST, PAYMENT_METHOD_ID);
      console.log(`Redirect url for card success onboarding: ${redirectUrl}`);
      await page.goto(redirectUrl);
      await registerOutcomeInterceptor(page);
      const testId = await registerPageOutcomeTracker(page);

      await fillCardDataForm(ONBOARDED_VALID_CARD_DATA);
      expect(page.url()).toContain('/gdi-check');
      await waitUntilUrlContains("/esito");
      expect(page.url()).toContain('/esito');
      const maxTimeToWait = 20000;
      const pollingResultUrlStartTime = Date.now();
      while(getOutcomeUrlForTest(testId)===undefined && Date.now()-pollingResultUrlStartTime < maxTimeToWait){
        console.log(`Waiting for outcome URL...`);
        await new Promise(r => setTimeout(r, 1000));
      }
      const url = getOutcomeUrlForTest(testId);
      const outcome = await getOutcome(url);
      expect(outcome === 0 || outcome === 15).toBe(true);
  });

  it('should redirect with outcome not equal to 0 (25) using a not valid card', async () => {
    const NOT_VALID_CARD_DATA = {
      number: '4242424242424242',
      expirationDate: '1230',
      ccv: '123',
      holderName: "TEST TEST",
    };
    const redirectUrl = await retrieveValidRedirectUrl(WALLET_HOST, PAYMENT_METHOD_ID);
    console.log(`Redirect url for not valid card onboarding: ${redirectUrl}`);
    await page.goto(redirectUrl);
    await registerOutcomeInterceptor(page);
    const testId = await registerPageOutcomeTracker(page);
    await fillCardDataForm(NOT_VALID_CARD_DATA);
    expect(page.url()).toContain('/gdi-check');
    await waitUntilUrlContains("/esito");
    expect(page.url()).toContain('/esito');
    const maxTimeToWait = 20000;
    const pollingResultUrlStartTime = Date.now();
    while(getOutcomeUrlForTest(testId)===undefined && Date.now()-pollingResultUrlStartTime < maxTimeToWait){
      console.log(`Waiting for outcome URL...`);
      await new Promise(r => setTimeout(r, 1000));
    }
    const url = getOutcomeUrlForTest(testId);
    const outcome = await getOutcome(url)
    expect(outcome).toBe(25);
  });
});


describe('Paypal Wallet: onboarding with NPG', () => {
  const WALLET_HOST = String(process.env.WALLET_HOST);
  const PAYMENT_METHOD_ID = String(process.env.PAYMENT_METHOD_ID_PAYPAL);
  const PAYPAL_ACCOUNT_DATA = {
    username: 'buyerpaypal@icbpi.it',
    password: 'buyerpaypal'
  };
  /**
   * Increase default test timeout (1 minutes)
   * to support entire payment flow
   */
  const timeout = 60_000;
  jest.setTimeout(timeout);
  jest.retryTimes(1);
  page.setDefaultNavigationTimeout(timeout);
  page.setDefaultTimeout(timeout);

  afterEach(async () => {
    await jestPuppeteer.resetPage();
  });

  it('should redirect with outcome 0 (success) success using paypal account', async () => {
    const redirectUrl = await retrieveValidRedirectUrl(WALLET_HOST, PAYMENT_METHOD_ID);
    await registerOutcomeInterceptor(page);
    const testId = await registerPageOutcomeTracker(page);
    console.log(`Redirect url for Paypal onboarding: ${redirectUrl}`);
    await page.goto(redirectUrl);
    await clickPaypalButton();
    await checkAndClickPaypalFirstPsps();
    await page.waitForNavigation();
    await waitUntilUrlContains("https://stg-ta.nexigroup.com/monetaweb/psp/paypal");
    
    const loginButtonPaypal = '[id^="zoid-paypal-buttons-uid"]';
    await page.waitForSelector(loginButtonPaypal, {timeout: 5000});
    await page.click(loginButtonPaypal);
  
    await fillPaypalAuthAndPay(PAYPAL_ACCOUNT_DATA);
    
    await waitUntilUrlContains("/esito");
    expect(page.url()).toContain('/esito');
    const maxTimeToWait = 20000;
    const pollingResultUrlStartTime = Date.now();
    while(getOutcomeUrlForTest(testId)===undefined && Date.now()-pollingResultUrlStartTime < maxTimeToWait){
      console.log(`Waiting for outcome URL...`);
      await new Promise(r => setTimeout(r, 1000));
    }
    const url = getOutcomeUrlForTest(testId);
    const walletIdOnboarded = await getWalletId(url);
    const outcome = await getOutcome(url);
    await new Promise(r => setTimeout(r, 1000));
    await cleanWalletOnboarded(WALLET_HOST, walletIdOnboarded);
    expect(outcome).toBe(0);
  });

  it('should redirect with outcome greater than 0 cancelling paypal onboarding', async () => {
    const redirectUrl = await retrieveValidRedirectUrl(WALLET_HOST, PAYMENT_METHOD_ID);
    console.log(`Redirect url for Paypal onboarding (user cancel): ${redirectUrl}`);
    await registerOutcomeInterceptor(page);
    const testId = await registerPageOutcomeTracker(page);
    await page.goto(redirectUrl);
    await clickPaypalButton();
    await checkAndClickPaypalFirstPsps();
    await page.waitForNavigation();
    await waitUntilUrlContains("https://stg-ta.nexigroup.com/monetaweb/psp/paypal");
    
    const loginButtonPaypal = '[id^="zoid-paypal-buttons-uid"]';
    await page.waitForSelector(loginButtonPaypal, {timeout: 5000});
    await page.click(loginButtonPaypal);
  
    await fillPaypalAuthAndCancel(PAYPAL_ACCOUNT_DATA);
    await waitUntilUrlContains("/esito");
    await new Promise(r => setTimeout(r, 1000));
    expect(page.url()).toContain('/esito');
    const maxTimeToWait = 20000;
    const pollingResultUrlStartTime = Date.now();
    while(getOutcomeUrlForTest(testId)===undefined && Date.now()-pollingResultUrlStartTime < maxTimeToWait){
      console.log(`Waiting for outcome URL...`);
      await new Promise(r => setTimeout(r, 1000));
    }
    const url = getOutcomeUrlForTest(testId);
    console.log(`Captured redirection url: [${url}]`);
    expect(url !== undefined).toBe(true);
    const outcome = new URLSearchParams(url.split("?")[1]).get("outcome");
    expect(parseInt(outcome)).toBe(8);
    
  });

});