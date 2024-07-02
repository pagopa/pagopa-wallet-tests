export const successfullyExecutionOnboarding = async (cardData, isXpay) => {
  let url = undefined;
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
  await fillCardForm(cardData);
  if (isXpay) {
    await execute_mock_authorization_xpay();
  }
  //there is no navigation after completing onboarding, just waiting for outcome redirection
  const maxTimeToWait = 20000;
  const pollingResultUrlStartTime = Date.now();
  while(url===undefined && Date.now()-pollingResultUrlStartTime < maxTimeToWait){
    console.log(`Waiting for outcome URL...`);
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log(`Captured redirection url: [${url}]`)
  return url;
};

export const onboardCardMethodWithError4xx = async (cardData) => {
  await fillCardForm(cardData);
  await page.waitForNavigation();
  const url = await page.url();
  return url;
};

export const onboardCardMethodWithNetworkError = async (cardData) => {
  const errorTitleSelector = '#inputCardPageErrorTitleId';
  page.setOfflineMode(true); // Set offline mode to simulate the opening of the modal
  await fillCardForm(cardData);
  const errorMessageElem = await page.waitForSelector(errorTitleSelector);
  const errorMessage = await errorMessageElem.evaluate(el => el.textContent)
  return errorMessage;
};

export const fillCardForm = async (cardData) => {
  const cardNumberInput = '#number';
  const expirationDateInput = '#expirationDate';
  const ccvInput = '#cvv';
  const holderNameInput = '#name';
  const continueBtnXPath = "button[type=submit]";
  await page.waitForSelector(cardNumberInput);
  await page.click(cardNumberInput);
  await page.keyboard.type(cardData.number);
  await page.waitForSelector(expirationDateInput);
  await page.click(expirationDateInput);
  await page.keyboard.type(cardData.expirationDate);
  await page.waitForSelector(ccvInput);
  await page.click(ccvInput);
  await page.keyboard.type(cardData.ccv);
  await page.waitForSelector(holderNameInput);
  await page.click(holderNameInput);
  await page.keyboard.type(cardData.holderName);

  const continueBtn = await page.waitForSelector(continueBtnXPath);
  await continueBtn.click();
};

const execute_mock_authorization_xpay = async () => {
  const dataInput = '#otipee';
  const confirmButton = 'button[name=btnAction]'
  const mockOTPCode = '123456';
  await page.waitForSelector(dataInput, { visible: true });
  await page.click(dataInput);
  await page.keyboard.type(mockOTPCode);
  await page.waitForSelector(confirmButton);
  await page.click(confirmButton);
  await page.waitForNavigation();
}

const execute_mock_authorization_vpos = async () => {
  const dataInput = '#challengeDataEntry';
  const confirmButton = '#confirm'
  const mockOTPCode = '123456';
  const verificationStep = 2;

  for (let idx = 0; idx < verificationStep; idx++) {
    console.log(`executing vpos verification step: ${idx}`);
    await page.waitForSelector(dataInput, { visible: true });
    await page.click(dataInput);
    await page.keyboard.type(mockOTPCode);

    await page.waitForSelector(confirmButton);
    await page.click(confirmButton);
  }
}

export const retrieveValidRedirectUrl = async (walletHost, walletToken, paymentMethodId) => {
  const startSessionUrl = `${walletHost}/session-wallet/v1/session`;
  console.log(`Performing POST session wallet to URL: ${startSessionUrl}`);
  const startSessionResponse = await (
    fetch(startSessionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${walletToken}`
      }
    })
  );
  if (startSessionResponse.status != 201) {
    throw Error(`Error performing start session: response status code: [${startSessionResponse.status}]`);
  }
  const sessionToken = await startSessionResponse.json().then(
    (body => body.token),
    (reason => { throw Error(`Error retrieving start session response body: [${reason}]`); })
  );

  const urlPostWallet = `${walletHost}/io-payment-wallet/v1/wallets`;
  console.log(`Performing POST wallets to URL: ${urlPostWallet}`);
  const responsePostWallet = await fetch(urlPostWallet, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${sessionToken}`
    },
    body: JSON.stringify({
      applications: ['PAGOPA'],
      useDiagnosticTracing: true,
      paymentMethodId,
    }),
  });

  if (responsePostWallet.status != 201) {
    throw Error(`Error while creating wallet! Received error code: [${responsePostWallet.status}]`);
  }

  return await responsePostWallet.json().then(
    createWalletResponse => createWalletResponse.redirectUrl,
    error => { throw new Error(`Error retrieving POST wallet body: [${error}]`) }
  );

}
