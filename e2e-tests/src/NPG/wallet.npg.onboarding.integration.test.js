import { fillCardDataForm, retrieveValidRedirectUrl, getOutcome, waitUntilUrlContains, clickPaypalButton, checkAndClickPaypalFirstPsps, fillPaypalAuth, cleanWalletOnboarded, getWalletId, getWalletAlreadyOnboarded } from './helper';

describe('Credit Card Wallet: onboarding with NPG', () => {
  const WALLET_HOST = String(process.env.WALLET_HOST);
  const PAYMENT_METHOD_ID = String(process.env.CREDIT_CARD_PAYMENT_METHOD_ID);
  const VALID_CARD_DATA = {
    number: '5127390031101597',
    expirationDate: '1025',
    ccv: '015',
    holderName: "TEST TEST",
  };
  const ONBOARDED_VALID_CARD_DATA = {
    number: '5255000260000014',
    expirationDate: '1230',
    ccv: '123',
    holderName: "TEST TEST",
  };
  /**
   * Increase default test timeout (60000ms)
   * to support entire payment flow
   */
  const timeout = 120_000;
  jest.setTimeout(timeout);
  jest.retryTimes(3);
  page.setDefaultNavigationTimeout(timeout);
  page.setDefaultTimeout(timeout);

  afterEach(async () => {
    await jestPuppeteer.resetPage();
  });

  it('should redirect with outcome 0 (success) success using a valid card', async () => {
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

    await fillCardDataForm(VALID_CARD_DATA);
    expect(page.url()).toContain('/gdi-check');
    await waitUntilUrlContains("/esito");
    const maxTimeToWait = 61000;
    const pollingResultUrlStartTime = Date.now();
    while(url === undefined && Date.now() - pollingResultUrlStartTime < maxTimeToWait) {
      console.log(`Waiting for outcome URL...`);
      await new Promise(r => setTimeout(r, 1000));
    }
    const outcome = await getOutcome(url)
    const walletId = await getWalletId(url)
    await cleanWalletOnboarded(WALLET_HOST, walletId)
    await new Promise(r => setTimeout(r, 2000));
    expect(outcome).toBe(0);
  });

  it('should redirect with outcome 15 (already onboarded) using an valid card already used', async () => {
    const walletIdOnboarded = await getWalletAlreadyOnboarded(WALLET_HOST, ONBOARDED_VALID_CARD_DATA.number.substring(ONBOARDED_VALID_CARD_DATA.number.length - 4));
    if(walletIdOnboarded !== undefined) {
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

      await fillCardDataForm(ONBOARDED_VALID_CARD_DATA);
      expect(page.url()).toContain('/gdi-check');
      await waitUntilUrlContains("/esito");
      expect(page.url()).toContain('/esito');
      const maxTimeToWait = 61000;
      const pollingResultUrlStartTime = Date.now();
      while(url===undefined && Date.now()-pollingResultUrlStartTime < maxTimeToWait){
        console.log(`Waiting for outcome URL...`);
        await new Promise(r => setTimeout(r, 1000));
      }
      const outcome = await getOutcome(url)
      expect(outcome).toBe(15);
    }
    expect(walletIdOnboarded).toBeDefined()
  });

  it('should redirect with outcome not equal to 0 (2) using a not valid card', async () => {
    const NOT_VALID_CARD_DATA = {
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
    await fillCardDataForm(NOT_VALID_CARD_DATA);
    expect(page.url()).toContain('/gdi-check');
    await waitUntilUrlContains("/esito");
    expect(page.url()).toContain('/esito');
    const maxTimeToWait = 61000;
    const pollingResultUrlStartTime = Date.now();
    while(url===undefined && Date.now()-pollingResultUrlStartTime < maxTimeToWait){
      console.log(`Waiting for outcome URL...`);
      await new Promise(r => setTimeout(r, 1000));
    }
    const outcome = await getOutcome(url)
    expect(outcome).toBe(2);
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
   * Increase default test timeout (60000ms)
   * to support entire payment flow
   */
  const timeout = 60_000;
  jest.setTimeout(timeout);
  jest.retryTimes(3);
  page.setDefaultNavigationTimeout(timeout);
  page.setDefaultTimeout(timeout);

  afterEach(async () => {
    await jestPuppeteer.resetPage();
  });

  it('should redirect with outcome 0 (success) success using paypal account', async () => {
    const redirectUrl = await retrieveValidRedirectUrl(WALLET_HOST, PAYMENT_METHOD_ID);

    await page.goto(redirectUrl)
    await clickPaypalButton()
    await checkAndClickPaypalFirstPsps()
    await page.waitForNavigation()
    await waitUntilUrlContains("https://stg-ta.nexigroup.com/monetaweb/psp/paypal")
    
    const loginButtonPaypal = '[id^="zoid-paypal-buttons-uid"]';
    await page.waitForSelector(loginButtonPaypal, {timeout: 5000});
    await page.click(loginButtonPaypal);
  
    await fillPaypalAuth(PAYPAL_ACCOUNT_DATA)
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
    await waitUntilUrlContains("/esito");
    expect(page.url()).toContain('/esito');
    const maxTimeToWait = 61000;
    const pollingResultUrlStartTime = Date.now();
    while(url===undefined && Date.now()-pollingResultUrlStartTime < maxTimeToWait){
      console.log(`Waiting for outcome URL...`);
      await new Promise(r => setTimeout(r, 1000));
    }
    const walletIdOnboarded = await getWalletId(url)
    const outcome = await getOutcome(url)
    await new Promise(r => setTimeout(r, 1000));
    await cleanWalletOnboarded(WALLET_HOST, walletIdOnboarded)
    expect(outcome).toBe(0);
  });

  it('should redirect with outcome greater than 0 cancelling paypal onboarding', async () => {
    const redirectUrl = await retrieveValidRedirectUrl(WALLET_HOST, PAYMENT_METHOD_ID);

    await page.goto(redirectUrl)
    let url;
    await clickPaypalButton()
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
    await checkAndClickPaypalFirstPsps()
    await page.waitForNavigation()
    await waitUntilUrlContains("https://stg-ta.nexigroup.com/monetaweb/psp/paypal")
    
    await new Promise(r => setTimeout(r, 2000));
    await page.waitForSelector('#back', {timeout: 5000});
    await page.click('#back');
    await page.waitForNavigation()
    await waitUntilUrlContains("/esito");
    await new Promise(r => setTimeout(r, 1000));
    expect(page.url()).toContain('/esito');
    const maxTimeToWait = 61000;
    const pollingResultUrlStartTime = Date.now();
    while(url===undefined && Date.now()-pollingResultUrlStartTime < maxTimeToWait){
      console.log(`Waiting for outcome URL...`);
      await new Promise(r => setTimeout(r, 1000));
    }
    console.log(`Captured redirection url: [${url}]`)
    expect(url !== undefined).toBe(true)
    const outcome = new URLSearchParams(url.split("?")[1]).get("outcome");
    expect(parseInt(outcome)).toBe(1);
    
  });

});