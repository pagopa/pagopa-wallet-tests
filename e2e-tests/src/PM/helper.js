export const successfullyExecutionOnboarding = async (cardData, isXpay) => {
    await fillCardForm(cardData);
    await page.waitForNavigation();
    if(isXpay){
      await execute_mock_authorization_xpay();
    } else{
      await execute_mock_authorization_vpos();
    }
    await page.waitForNavigation();
    const url = await page.url();
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

const execute_mock_authorization_xpay = async() => {
    const dataInput = '#otipee';
    const confirmButton = 'button[name=btnAction]'
    const mockOTPCode = '123456';
    await page.waitForSelector(dataInput, {visible: true});
    await page.click(dataInput);
    await page.keyboard.type(mockOTPCode);
    await page.waitForSelector(confirmButton);
    await page.click(confirmButton);
    await page.waitForNavigation();
  }

  const execute_mock_authorization_vpos = async() => {
    const dataInput = '#challengeDataEntry';
    const confirmButton = '#confirm'
    const mockOTPCode = '123456';
    const verificationStep = 2;
  
    for(let idx =0; idx < verificationStep;  idx++){
      console.log(`executing vpos verification step: ${idx}`);
      await page.waitForSelector(dataInput, {visible: true});
      await page.click(dataInput);
      await page.keyboard.type(mockOTPCode);
  
      await page.waitForSelector(confirmButton);
      await page.click(confirmButton);
    }
  }

export const retrieveValidRedirectUrl = async (pmHost) => {
    const urlGetUser = `https://portal.test.pagopa.gov.it/pmmockserviceapi/cd/user/get`;
    const responseGetUser = await fetch(urlGetUser, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    });

    if(responseGetUser.status === 200){
        const user = await responseGetUser.json();
        const walletTokenCreditCard = user.sessionToken;
        const urlPutUser = `https://portal.test.pagopa.gov.it/pmmockserviceapi/cd/user/save`;
        const responsePutUser = await fetch(urlPutUser, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(user)
        });
        if(responsePutUser.status === 200){
            const urlStartSession = `${pmHost}/payment-wallet/v1/wallets`;
            const responseStartSession = await fetch(urlStartSession, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${walletTokenCreditCard}`
              }
            });
            if(responseStartSession.status === 201){
                const session = await responseStartSession.json();
                return session.redirectUrl
            }else{
                console.log(responseStartSession.status)
                throw Error("Error while start session");
            }
        } else {
            throw Error("Error while saving user");
        }
       
    }else{
        throw Error("Error during user recovery");
    }

    
}
