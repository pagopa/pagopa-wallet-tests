
export const onboardCardMethodWithError = async (cardData) => {
    const errorTitleSelector = '#inputCardPageErrorTitleId';
    await fillCardForm(cardData);
    const errorMessageElem = await page.waitForXPath(errorTitleSelector);
    return await errorMessageElem.evaluate(el => el.textContent);
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