import { Page } from '@playwright/test';

/**
 * Extracts the outcome parameter from a URL.
 *
 * @param url - The URL string to parse
 * @returns The outcome as a number, or -1 if not found or invalid
 */
export const getOutcome = (url: string | undefined): number => {
  if (!url) {
    console.warn('getOutcome called with undefined URL');
    return -1;
  }

  console.log(`Parsing outcome from URL...`);

  try {
    const urlParts = url.split('?');
    if (urlParts.length < 2) {
      console.warn('No query string found in URL');
      return -1;
    }

    const params = new URLSearchParams(urlParts[1]);
    const outcomeStr = params.get('outcome');

    if (outcomeStr === null) {
      console.warn('No outcome parameter found in URL');
      return -1;
    }

    const outcome = parseInt(outcomeStr, 10);
    console.log(`Extracted outcome: ${outcome}`);
    return outcome;
  } catch (error) {
    console.error(`Error parsing outcome from URL: ${error}`);
    return -1;
  }
};

/**
 * Extracts the transactionId parameter from a URL.
 * Supports both query parameter and path-based formats:
 * - Query param: ?transactionId=xxx
 * - Path: /transactions/{transactionId}/outcomes
 *
 * @param url - The URL string to parse
 * @returns The transactionId as a string, or empty string if not found
 */
export const getTransactionId = (url: string | undefined): string => {
  if (!url) {
    console.warn('getTransactionId called with undefined URL');
    return '';
  }

  console.log(`Parsing transactionId from URL...`);

  try {
    // First, try to extract from query parameters
    const urlParts = url.split('?');
    if (urlParts.length >= 2) {
      const params = new URLSearchParams(urlParts[1]);
      const transactionId = params.get('transactionId');
      if (transactionId) {
        console.log(`Extracted transactionId from query param: ${transactionId}`);
        return transactionId;
      }
    }

    // If not in query params, try to extract from path: /transactions/{id}/outcomes
    const pathMatch = url.match(/\/transactions\/([^/?]+)\/outcomes/);
    if (pathMatch && pathMatch[1]) {
      const transactionId = pathMatch[1];
      console.log(`Extracted transactionId from path: ${transactionId}`);
      return transactionId;
    }

    console.warn('No transactionId found in URL (checked both query params and path)');
    return '';
  } catch (error) {
    console.error(`Error parsing transactionId from URL: ${error}`);
    return '';
  }
};

/**
 * Extracts the orderId parameter from a URL.
 *
 * @param url - The URL string to parse
 * @returns The orderId as a string, or empty string if not found
 */
export const getOrderId = (url: string | undefined): string => {
  if (!url) {
    console.warn('getOrderId called with undefined URL');
    return '';
  }

  console.log(`Parsing orderId from URL...`);

  try {
    const urlParts = url.split('?');
    if (urlParts.length < 2) {
      console.warn('No query string found in URL');
      return '';
    }

    const params = new URLSearchParams(urlParts[1]);
    const orderId = params.get('orderId');

    if (orderId === null) {
      console.warn('No orderId parameter found in URL');
      return '';
    }

    console.log(`Extracted orderId: ${orderId}`);
    return orderId;
  } catch (error) {
    console.error(`Error parsing orderId from URL: ${error}`);
    return '';
  }
};

/**
 * Polls for a condition with exponential backoff.
 *
 * @param condition - Function that returns true when the condition is met
 * @param maxWaitTime - Maximum time to wait in milliseconds
 * @param pollInterval - Initial polling interval in milliseconds (default: 1000)
 * @returns True if condition was met, false if timeout reached
 */
export const pollForCondition = async (
  condition: () => boolean | Promise<boolean>,
  maxWaitTime: number = 20_000,
  pollInterval: number = 1_000
): Promise<boolean> => {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    const result = await condition();
    if (result) {
      return true;
    }

    console.log(`Polling... elapsed time: ${Date.now() - startTime}ms`);
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  console.warn(`Polling timed out after ${maxWaitTime}ms`);
  return false;
};

/**
 * Fills a card data form with retry logic.
 *
 * @param page - The Playwright page instance
 * @param cardData - Card information to fill
 */
export const fillCardDataForm = async (
  page: Page,
  cardData: {
    number: string;
    expirationDate: string;
    ccv: string;
    holderName: string;
  }
): Promise<void> => {
  const cardNumberInput = '#frame_CARD_NUMBER';
  const expirationDateInput = '#frame_EXPIRATION_DATE';
  const ccvInput = '#frame_SECURITY_CODE';
  const holderNameInput = '#frame_CARDHOLDER_NAME';
  const continueBtnSelector = 'button[type=submit]';
  const disabledContinueBtnSelector = 'button[type=submit][disabled]';

  let iteration = 0;
  let completed = false;

  while (!completed) {
    iteration++;
    console.log(`Filling card form... iteration ${iteration}`);

    // Fill card number
    await page.waitForSelector(cardNumberInput, { state: 'visible' });
    await page.click(cardNumberInput, { clickCount: 3 });
    await page.keyboard.type(cardData.number);

    // Fill expiration date
    await page.waitForSelector(expirationDateInput, { state: 'visible' });
    await page.click(expirationDateInput, { clickCount: 3 });
    await page.keyboard.type(cardData.expirationDate);

    // Fill CCV
    await page.waitForSelector(ccvInput, { state: 'visible' });
    await page.click(ccvInput, { clickCount: 3 });
    await page.keyboard.type(cardData.ccv);

    // Fill cardholder name
    await page.waitForSelector(holderNameInput, { state: 'visible' });
    await page.click(holderNameInput, { clickCount: 3 });
    await page.keyboard.type(cardData.holderName);

    console.log('Card data filled');

    // Check if continue button is enabled
    completed = (await page.$(disabledContinueBtnSelector)) === null;

    await page.waitForTimeout(1_000);
  }

  // Click continue button
  const continueBtn = await page.waitForSelector(continueBtnSelector, { state: 'visible' });
  await continueBtn.click();
  console.log('Continue button clicked');
};