
export const onboardCardMethodWithError4xx = async (cardData) => {
    await fillCardForm(cardData);
    await page.waitForNavigation();
    const url = await page.url();
    return url;
};

export const onboardCardMethodWithError5xx = async (cardData) => {
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