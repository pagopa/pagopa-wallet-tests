import { randomIntFromInterval } from "../utils/numbers";


export const retrieveValidRedirectUrl = async (walletHost, paymentMethodId) => {
  const urlStartSession = `${walletHost}/session-wallet/mock/v1/session`;
  const responseStartSession = await fetch(urlStartSession, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      userId: "415f36b1-c321-4e6f-a91d-1c8dcc22461f",
      expiryInMinutes: 60
    }),
  });
  if (responseStartSession.status === 201) {
    const sessionResponse = await responseStartSession.json();
    const sessionToken = sessionResponse.token;
    const urlPostWallet = `${walletHost}/io-payment-wallet/v1/wallets`;
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
    if (responsePostWallet.status === 201) {
      const session = await responsePostWallet.json();
      return session.redirectUrl
    } else {
      throw Error(`Error while creating wallet! status code: ${responsePostWallet.status}, response: ${JSON.stringify(await responsePostWallet.json())}`);
    }
  } else {
    throw Error(`Error while start session! status code: ${responseStartSession.status}, response: ${JSON.stringify(await responseStartSession.json())}`);
  }
};

export const retrievePaymentRedirectUrl = async (walletHost, userId, walletType, pspId) => {
  const RPTID_NM3 = "77777777777" + "302001" + randomIntFromInterval(0, 999999999999);

  const urlStartSession = `${walletHost}/session-wallet/mock/v1/session`;
  const responseStartSession = await fetch(urlStartSession, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      userId: userId,
      expiryInMinutes: 60
    }),
  });
  console.debug('start session');
  if (responseStartSession.status === 201) {
    console.debug('start session 201');
    const sessionData = await responseStartSession.json();
    const urlRprtIdInfo = `${walletHost}/ecommerce/io/v2/payment-requests/${RPTID_NM3}`;
    const responseRptIdInfo = await fetch(urlRprtIdInfo, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionData.token}`,
      }
    });
    console.debug('verify rptId');
    if (responseRptIdInfo.status === 200) {
      console.debug('verify rptId 200');
      const rptidInfoData = await responseRptIdInfo.json();
      const urlUserWallet = `${walletHost}/ecommerce/io/v2/wallets`;
      const responseUserWallet = await fetch(urlUserWallet, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.token}`,
        }
      });
      console.debug('get wallet');
      if (responseUserWallet.status === 200) {
        const walletData = await responseUserWallet.json();
        console.debug(`get wallet 200, wallet response data: ${JSON.stringify(walletData)}`);
        const { walletId, paymentMethodId } = walletData.wallets.find(w => w?.details?.type === walletType);
        const urlPaymentTransaction = `${walletHost}/ecommerce/io/v2/transactions`;
        const responsePaymentTransaction = await fetch(urlPaymentTransaction, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionData.token}`,
          },
          body: JSON.stringify({
            paymentNotices: [{
              rptId: `${RPTID_NM3}`,
              amount: rptidInfoData.amount
            }]
          }),
        })
        console.debug('post transaction');
        if (responsePaymentTransaction.status === 200) {
          console.debug('post transaction 200');
          const paymentTransactionData = await responsePaymentTransaction.json();
          const urlFees = `${walletHost}/ecommerce/io/v2/payment-methods/${paymentMethodId}/fees`;
          const transferList = [];
          paymentTransactionData.payments[0].transferList.forEach(el => transferList.push({
            "creditorInstitution": el.paFiscalCode,
            "digitalStamp": el.digitalStamp,
            "transferCategory": el.transferCategory
          }))
          console.debug(paymentTransactionData)

          const feeBodyRequest = {
            walletId,
            language: "it",
            paymentAmount: rptidInfoData.amount,
            primaryCreditorInstitution: "77777777777",
            idPspList: [],
            isAllCCP: paymentTransactionData.payments[0].isAllCCP,
            transferList: transferList
          }
          console.debug(feeBodyRequest)
          const responseFees = await fetch(urlFees, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${sessionData.token}`,
            },
            body: JSON.stringify(feeBodyRequest),
          })
          console.debug('post fees');
          if (responseFees.status === 200) {
            console.debug('post fees 200');
            const feesData = await responseFees.json();
            const urlAuthRequest = `${walletHost}/ecommerce/io/v2/transactions/${paymentTransactionData.transactionId}/auth-requests`;
            //use wanted psp id
            console.debug(`Calculate fees response: ${JSON.stringify(await feesData)}`);
            const filteredBundles = feesData.bundles.filter(bundle => bundle.idPsp === pspId);
            console.debug(`Filtered bundles for pspId: [${pspId}] -> ${JSON.stringify(filteredBundles)}`);
            if (filteredBundles.length == 0) {
              throw Error(`Cannot find bundle for psp with id: [${pspId}]`);
            }
            const bundle = filteredBundles[0];
            const responseAuthRequest = await fetch(urlAuthRequest, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${sessionData.token}`,
              },
              body: JSON.stringify({
                amount: rptidInfoData.amount,
                fee: bundle.taxPayerFee,
                pspId: bundle.idPsp,
                paymentInstrumentId: paymentMethodId,
                language: "IT",
                isAllCCP: true,
                details: {
                  detailType: "wallet",
                  walletId: walletId
                }
              }),
            })
            console.debug('post auth request');
            if (responseAuthRequest.status === 200) {
              console.debug('post auth request 200');
              const authRequest = await responseAuthRequest.json();
              return authRequest.authorizationUrl;
            } else {
              throw Error(`Error during auth request! status code: ${responseAuthRequest.status}, response: ${JSON.stringify(await responseAuthRequest.json())}`);
            }
          } else {
            throw Error(`Error getting fees! status code: ${responseFees.status}, response: ${JSON.stringify(await responseFees.json())}`);
          }
        } else {
          throw Error(`Error during transaction! status code: ${responsePaymentTransaction.status}, response: ${JSON.stringify(await responsePaymentTransaction.json())}`);
        }
      } else {
        throw Error(`Error getting wallet! status code: ${responseUserWallet.status}, response: ${JSON.stringify(await responseUserWallet.json())}`);
      }
    } else {
      throw Error(`Error getting rptId! status code: ${responseRptIdInfo.status}, response: ${JSON.stringify(await responseRptIdInfo.json())}`);
    }
  } else {
    throw Error(`Error starting session! status code: ${responseStartSession.status}, response: ${JSON.stringify(await responseStartSession.json())}`);
  }
};

export const clickPaypalButton = async () => {
  const preambleButton = '#preambleButton'
  await page.click(preambleButton)
}

export const checkAndClickPaypalFirstPsps = async () => {
  const radioButtonIntesa = await page.waitForSelector('#BCITITMM')
  await radioButtonIntesa.click()
  const submitPsp = await page.waitForSelector('#apmSubmit')
  await submitPsp.click()
}

export const fillPaypalAuthAndPay = async paypalCredentials => {
  const payButton = '#consentButton';
  const popup = await loginToPaypal(paypalCredentials);
  await popup.waitForSelector(payButton, { timeout: 10000 });
  await popup.click(payButton);
}

export const fillPaypalAuthAndCancel = async paypalCredentials => {
  const cancelLink = '#cancelLink';
  const popup = await loginToPaypal(paypalCredentials);
  await popup.waitForSelector(cancelLink, { timeout: 10000 });
  await popup.click(cancelLink);
}

export const loginToPaypal = async paypalCredentials => {
  const usernameInput = '#email';
  const btnNext = '#btnNext';
  const pwInput = '#password';
  const loginButton = '#btnLogin';

  const targets = await browser.targets();
  const popup = await targets[targets.length - 1].page();
  await popup.waitForNavigation();
  const popupUrl = popup.url();
  console.log(`popup url: ${popupUrl}`);
  if (!popupUrl.includes("billing")) {
    await popup.waitForSelector(usernameInput, { timeout: 10000 });
    await popup.click(usernameInput, { clickCount: 3 });
    await popup.keyboard.type(paypalCredentials.username);
    await popup.waitForSelector(btnNext, { timeout: 10000 });
    await popup.click(btnNext);
    await popup.waitForSelector(pwInput, { timeout: 10000 });
    await new Promise(r => setTimeout(r, 2000));
    await popup.focus(pwInput);
    await new Promise(r => setTimeout(r, 2000));
    popup.keyboard.type(paypalCredentials.password);
    await new Promise(r => setTimeout(r, 2000));
    const login = await popup.waitForSelector(loginButton, { timeout: 10000, visible: true });
    await new Promise(r => setTimeout(r, 2000));
    await login.click();
  } else {
    console.log("Skipping paypal login phase, user already logged detected");
  }

  return popup;
}

export const fillCardDataForm = async cardData => {
  const cardNumberInput = '#frame_CARD_NUMBER';
  const expirationDateInput = '#frame_EXPIRATION_DATE';
  const ccvInput = '#frame_SECURITY_CODE';
  const holderNameInput = '#frame_CARDHOLDER_NAME';
  const continueBtnXPath = 'button[type=submit]';
  const disabledContinueBtnXPath = 'button[type=submit][disabled=""]';
  let iteration = 0;
  let completed = false;
  while (!completed) {
    iteration++;
    console.log(`Compiling fields...${iteration}`);
    await page.waitForSelector(cardNumberInput, { visible: true });
    await page.click(cardNumberInput, { clickCount: 3 });
    await page.keyboard.type(cardData.number);
    console.log('card number performed');
    await page.waitForSelector(expirationDateInput, { visible: true });
    await page.click(expirationDateInput, { clickCount: 3 });
    await page.keyboard.type(cardData.expirationDate);
    console.log('expiration performed');
    await page.waitForSelector(ccvInput, { visible: true });
    await page.click(ccvInput, { clickCount: 3 });
    await page.keyboard.type(cardData.ccv);
    console.log('cvv performed');
    await page.waitForSelector(holderNameInput, { visible: true });
    await page.click(holderNameInput, { clickCount: 3 });
    await page.keyboard.type(cardData.holderName);
    console.log('holder performed');
    completed = !(await page.$(disabledContinueBtnXPath));
    await page.waitForTimeout(1_000);
  }
  const continueBtn = await page.waitForSelector(continueBtnXPath, { visible: true });
  await continueBtn.click();
  await page.waitForNavigation();
};

/**
 * This function is usefull when we need to wait for the puppeter page instance get a certain
 * url value based on the inclusion of the urlSubstring parameter
 */
export const waitUntilUrlContains = async (urlSubstring) =>
  await page.waitForFunction(`window.location.href.includes("${urlSubstring}")`);

/**
 * This function wait for obtain the outcome parameter from the final result url
 * when the gdi check phase, the 3ds challenge and esito phase ends
 * @returns number
 */
export const getOutcome = async (url) => {
  console.log(url)
  const outcome = new URLSearchParams(url?.split("?")[1]).get("outcome");
  console.log(outcome);
  if (outcome == null) {
    return -1;
  }
  return parseInt(outcome)
}

/**
 * This function wait for obtain the walletOd parameter from the final result url
 * when the gdi check phase, the 3ds challenge and esito phase ends
 * @returns number
 */
export const getWalletId = async (url) => {
  console.log(`getWalletId from url ${url}`)
  const walletId = new URLSearchParams(url?.split("?")[1]).get("walletId");
  console.debug(`walletId detected ${walletId}`);
  if (walletId == null) {
    return "";
  }
  return walletId
}

/**
 * This function wait for obtain the walletId of the wallet for the last four digits in parameters.
 * It is useful to verify that we are testing an already onboarded outcome with a card number effectively already onboarded
 * Since the parameters is the last four digits, card with the same last four digits could be returned. For test puprose we 
 * can assume this sub-ptimum result as a reliable result
 * @returns string
 */
export const getWalletAlreadyOnboarded = async (walletHost, lastFourDigitsOnboarded) => {
  console.debug(`GET wallet already onboarded with last four digits ${lastFourDigitsOnboarded}`)
  const urlStartSession = `${walletHost}/session-wallet/mock/v1/session`;
  const responseStartSession = await fetch(urlStartSession, {
    method: 'POST',
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      userId: "00000000-0000-0000-0000-000000000000",
      expiryInMinutes: 60
    }),
  });
  if (responseStartSession.status === 201) {
    console.debug('session 201');
    const sessionData = await responseStartSession.json();
    const sessionToken = sessionData.token;
    const urlPostWallet = `${walletHost}/io-payment-wallet/v1/wallets`;
    const responseGetWallets = await fetch(urlPostWallet, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${sessionToken}`
      }
    });
    if (responseGetWallets.status === 200) {
      console.debug("GET /wallets 200");
      const walletsBody = await responseGetWallets.json();
      const walletId = walletsBody.wallets.filter(w => w.details.type === "CARDS" && w.details.lastFourDigits === lastFourDigitsOnboarded)[0].walletId
      console.debug(`Wallet id for the same card ${walletId}`);
      return walletId
    } else {
      throw Error(`Error getting wallet! status code: ${responseGetWallets.status}, response: ${JSON.stringify(await responseGetWallets.json())}`);
    }
  } else {
    throw Error(`Error starting session! status code: ${responseStartSession.status}, response: ${JSON.stringify(await responseStartSession.json())}`);
  }
}

/**
 * This function wait for deleting a wallet by its id. 
 * It is useful when we test an onboarding and we want to reply the test without changing card data or wallet token
 */
export const cleanWalletOnboarded = async (walletHost, walletId) => {
  console.debug(`Deleting wallet ${walletId}`)
  const urlStartSession = `${walletHost}/session-wallet/mock/v1/session`;
  const responseStartSession = await fetch(urlStartSession, {
    method: 'POST',
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      userId: "00000000-0000-0000-0000-000000000000",
      expiryInMinutes: 60
    }),
  });
  if (responseStartSession.status === 201) {
    console.debug('session 201');
    const sessionData = await responseStartSession.json();
    const sessionToken = sessionData.token;
    const urlDeleteWallet = `${walletHost}/io-payment-wallet/v1/wallets/${walletId}`;
    const responseDeleteWallet = await fetch(urlDeleteWallet, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${sessionToken}`
      }
    });
    if (responseDeleteWallet.status === 204) {
      console.debug("Wallet deleted 204");
    } else {
      throw Error(`Error deleting wallet! status code: ${responseDeleteWallet.status}, response: ${JSON.stringify(await responseDeleteWallet.json())}`);
    }
  } else {
    throw Error(`Error starting session! status code: ${responseStartSession.status}, response: ${JSON.stringify(await responseStartSession.json())}`);
  }
}