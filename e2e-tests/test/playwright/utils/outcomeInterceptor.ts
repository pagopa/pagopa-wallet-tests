import { Page } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';

const APIM_HOST = String(process.env.APIM_HOST);
const TEST_ID_COOKIE_NAME = 'testId';

/**
 * Map to store intercepted outcome URLs indexed by test ID
 */
const interceptedOutcomeUrls: Record<string, string> = {};

/**
 * Registers a request interceptor that listens for outcome URLs and associates them
 * with the test ID.
 *
 * Outcome URLs are:
 * - Onboarding: https://api.<env>.platform.pagopa.it/payment-wallet-outcomes/v1/wallets/outcomes?outcome=0
 * - Payment: https://api.<env>.platform.pagopa.it/ecommerce/io-outcomes/v1/transactions/{transactionId}/outcomes?outcome=0
 *
 * Usage example:
 * await registerOutcomeInterceptor(page);
 * const testId = await registerPageOutcomeTracker(page);
 * // then retrieve the intercepted outcome URL
 * const url = getOutcomeUrlForTest(testId);
 *
 * @param page - The Playwright page instance on which to register the outcome interceptor
 */
export const registerOutcomeInterceptor = async (page: Page): Promise<void> => {
  await page.route('**/*', async (route, request) => {
    const requestUrl = request.url();

    if (
      requestUrl.includes(`${APIM_HOST}/payment-wallet-outcomes/`) ||
      requestUrl.includes(`${APIM_HOST}/ecommerce/io-outcomes`)
    ) {
      try {
        const cookies = await page.context().cookies();
        const testIdCookie = cookies.find((cookie) => cookie.name === TEST_ID_COOKIE_NAME);

        if (testIdCookie) {
          const testId = testIdCookie.value;
          if (!interceptedOutcomeUrls[testId] || interceptedOutcomeUrls[testId] !== requestUrl) {
            interceptedOutcomeUrls[testId] = requestUrl;
          }
        }
      } catch (error) {
        console.error(`Error intercepting outcome URL: ${error}`);
      }
    }

    await route.continue();
  });
};

/**
 * Retrieves the outcome URL associated with the given test ID.
 *
 * @param testId - The test ID as returned by registerPageOutcomeTracker
 * @returns The intercepted outcome API call URL associated with the test ID, or undefined if none exists
 */
export const getOutcomeUrlForTest = (testId: string): string | undefined => {
  return interceptedOutcomeUrls[testId];
};

/**
 * Registers a test tracker by setting a custom cookie in the current test page
 * for the APIM domain. This cookie is used to track back outcome URLs to the
 * originating test instance.
 *
 * @param page - The Playwright page instance on which the test will be executed
 * @returns The randomly generated test ID to be used to retrieve the outcome URL
 */
export const registerPageOutcomeTracker = async (page: Page): Promise<string> => {
  const testId = uuidv4();
  const domain = APIM_HOST.replace('https://', '').replace('http://', '');

  const testCookie = {
    name: TEST_ID_COOKIE_NAME,
    value: testId,
    domain: domain,
    path: '/',
  };

  await page.context().addCookies([testCookie]);

  return testId;
};

/**
 * Clears all intercepted outcome URLs.
 * Useful for cleaning up between tests.
 */
export const clearInterceptedOutcomes = (): void => {
  Object.keys(interceptedOutcomeUrls).forEach((key) => {
    delete interceptedOutcomeUrls[key];
  });
};