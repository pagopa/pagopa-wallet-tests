import { v4 as uuidv4 } from 'uuid';

const APIM_HOST = String(process.env.APIM_HOST);

const TEST_ID_COOKIE_NAME = "testId"

const interceptedOutcomeUrls = {}
/**
  This function register a request interceptor that will listen for every outcome urls that matches
  the outcome redirection url and associate it to the test id (as per the test cookie set at the page level)
  outcome urls are: 
  onboarding -> https://api.<env>.platform.pagopa.it/payment-wallet-outcomes/v1/wallets/outcomes?outcome=0
  payment -> https://api.<env>.platform.pagopa.it/ecommerce/io-outcomes/v1/transactions/8eb8dabfdcc043c990eb1f75b9c95875/outcomes?outcome=0 
  
  To register an outcome interceptor you can add the following lines to your test
  //`
    await registerOutcomeInterceptor(page); //register outcome interceptor
    const testId = await registerPageOutcomeTracker(page); //register an outcome url tracker for the current test, obtaining an unique test id

    //that can be used later to retrieve the intercepted outcome url, if any
    const url = getOutcomeUrlForTest(testId);
  `</code>`
  
 * @param {*} page the page instance on which register the outcome interceptor
 */
export const registerOutcomeInterceptor = async (page) => {
    page.on('request', request => {
        if (request.isInterceptResolutionHandled()) return;
        const requestUrl = request.url();
        if (
            requestUrl.includes(`${APIM_HOST}/payment-wallet-outcomes/`) ||
            requestUrl.includes(`${APIM_HOST}/ecommerce/io-outcomes`)
        ) {

            const requestCookies = request.headers().cookie.split(";");
            console.log(`Intercepted outcome url: ${requestUrl} with cookies: ${JSON.stringify(requestCookies)}`);
            const testId = requestCookies.find(cookie => cookie.includes(TEST_ID_COOKIE_NAME)).replace(`${TEST_ID_COOKIE_NAME}=`, "");
            console.log(`Extracted test id: [${testId}]`);
            if (testId !== undefined) {
                interceptedOutcomeUrls[testId] = requestUrl;
            }
        }
        request.continue();
    });
    await page.setRequestInterception(true);
}

/**
 * Retrieve the outcome associated to the test id or undefined if no request have been successfully registered
 * @param {string} testId the test id as returned by the registerPageOutcomeTracker call
 * @returns the intercepted outcome api call associated to the input test id, if any
 */
export const getOutcomeUrlForTest = (testId) => {
    return interceptedOutcomeUrls[testId];
}

/**
 * Register a test tracker by setting a custom cookie in the current test page for the apim domain so that the same cookie can be used to track back outcome url
 * to the originating test instance
 * @param {*} page the puppeteer page instance on which the test will be executed
 * @returns the randomically generated test id to be used to retrieve outcome url
 */
export const registerPageOutcomeTracker = async (page) => {
    const testId = uuidv4();
    const testCookie = { name: TEST_ID_COOKIE_NAME, value: testId, domain: APIM_HOST.replace("https://", ""), path: '/' };
    console.log(`Test cookie: ${JSON.stringify(testCookie)}`);
    await page.setCookie(testCookie);
    await page.setRequestInterception(true);
    return testId;
}


