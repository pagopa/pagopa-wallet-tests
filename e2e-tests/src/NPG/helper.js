//import { HTTPResponse } from "puppeteer";
import { randomIntFromInterval } from "../utils/numbers";

//const { APIM_HOST } = process.env.APIM_HOST
const WALLET_TOKEN= String(process.env.USER_WALLET_TOKEN);


export const retrieveValidRedirectUrl = async (walletHost, paymentMethodId) => {
  /*const urlGetUser = `${APIM_HOST}/pmmockserviceapi/cd/user/get`;
  const responseGetUser = await fetch(urlGetUser, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (responseGetUser.status === 200) {
    const user = await responseGetUser.json();
    const walletTokenCreditCard = user.sessionToken;
    const urlPutUser = `${APIM_HOST}/pmmockserviceapi/cd/user/save`;
    const responsePutUser = await fetch(urlPutUser, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(user),
    });
    if (responsePutUser.status === 200) {*/

    const walletTokenCreditCard = WALLET_TOKEN
      const urlStartSession = `${walletHost}/session-wallet/v1/session`;
      const responseStartSession = await fetch(urlStartSession, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${walletTokenCreditCard}`
        }
      });
      if(responseStartSession.status === 201){
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
        if(responsePostWallet.status === 201){
            const session = await responsePostWallet.json();
            return session.redirectUrl
        }else{
            console.log(responsePostWallet.status)
            throw Error("Error while creating wallet");
        }
      }else{
          console.log(responseStartSession.status)
          throw Error("Error while start session");
      }  
      /*
    } else {
      throw Error('Error while saving user');
    }
  } else {
    throw Error('Error during user recovery');
  }*/
};

export const retrievePaymentRedirectUrl = async (walletHost, walletToken) => {
  const RPTID_NM3 = "77777777777" + "302001" + randomIntFromInterval(0, 999999999999);

    const urlStartSession = `${walletHost}/session-wallet/v1/session`;
    const responseStartSession = await fetch(urlStartSession, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${walletToken}`,
      }
    });
    if(responseStartSession.status === 201) {
      console.debug('session 201');
      const sessionData = await responseStartSession.json();
      const urlRprtIdInfo = `${walletHost}/ecommerce/io/v2/payment-requests/${RPTID_NM3}`;
      const responseRptIdInfo = await fetch(urlRprtIdInfo, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.token}`,
        }
      });
      if(responseRptIdInfo.status === 200) {
        console.debug('rpt 200');
        const rptidInfoData = await responseRptIdInfo.json();
        const urlUserWallet = `${walletHost}/ecommerce/io/v2/wallets`;
        const responseUserWallet = await fetch(urlUserWallet, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionData.token}`,
          }
        });
        if (responseUserWallet.status === 200) {
          console.debug('wallet 200');
          const walletData = await responseUserWallet.json();
          const { walletId, paymentMethodId } = walletData.wallets.find(w => w?.details?.type === "CARDS");
          const urlPaymentTransaction = `${walletHost}/ecommerce/io/v2/transactions`;
          console.log(urlPaymentTransaction)
        const responsePaymentTransaction = await fetch(urlPaymentTransaction, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionData.token}`,
          },
          body: JSON.stringify({
            paymentNotices: [{
              rptId: `${RPTID_NM3}`,
              amount: 12000
            }]
          }),
        })
        if(responsePaymentTransaction.status === 200) {
          console.debug('transaction 200');
          const paymentTransactionData = await responsePaymentTransaction.json();
          const urlFees = `${walletHost}/ecommerce/io/v2/payment-methods/${paymentMethodId}/fees`;
          const transferList = [];
          paymentTransactionData.payments[0].transferList.forEach(el => transferList.push({
            "creditorInstitution": el.paFiscalCode,
            "digitalStamp": el.digitalStamp,
            "transferCategory": el.transferCategory
          }))

          const feeBodyRequest = {
            walletId,
            language: "it",
            paymentAmount: rptidInfoData.amount,
            primaryCreditorInstitution: "77777777777",
            idPspList: [],
            isAllCCP: true,
            transferList: transferList
          }
          const responseFees = await fetch(urlFees, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${sessionData.token}`,
            },
            body: JSON.stringify(feeBodyRequest),
          })
          if (responseFees.status === 200) {

            console.debug('fees 200');
            const feesData = await responseFees.json();
            const urlAuthRequest = `${walletHost}/ecommerce/io/v2/transactions/${paymentTransactionData.transactionId}/auth-requests`;
            const responseAuthRequest = await fetch(urlAuthRequest, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${sessionData.token}`,
              },
              body: JSON.stringify({
                amount: rptidInfoData.amount,
                fee: feesData.bundles[0].taxPayerFee,
                pspId: feesData.bundles[0].idPsp,
                paymentInstrumentId: paymentMethodId,
                language: "IT",
                isAllCCP: true,
                details: {
                  detailType: "wallet",
                  walletId
                }
              }),
            })
            if (responseAuthRequest.status === 200) {
              console.debug('auth request 200');
              const authRequest = await responseAuthRequest.json();
              return authRequest.authorizationUrl;
            } else {
              throw Error('Error during auth request');
            }
          } else {
            throw Error('Error getting fees');
          }
        } else {
          throw Error('Error during transaction');
        }
        } else {
          throw Error('Error getting wallet');
        }


      } else {
        throw Error('Error getting rptId');
      }
    } else {
      throw Error('Error starting session');
    }
};

export const clickPaypalButton = async () => {
  const preambleButton = '#preambleButton'
  await page.click(preambleButton)
}

export const checkAndClickPaypalFirstPsps = async () => {
  const radioButtonIntesa = await page.waitForSelector('#root > div > div > div > div.MuiBox-root.css-0 > div.MuiFormControl-root.css-tzsjye > div > label:nth-child(1) > span.MuiButtonBase-root.MuiRadio-root.MuiRadio-colorPrimary.PrivateSwitchBase-root.MuiRadio-root.MuiRadio-colorPrimary.MuiRadio-root.MuiRadio-colorPrimary.css-fa98ss > input')
  await radioButtonIntesa.click()
  const submitPsp = await page.waitForXPath('/html/body/div/div/div/div/div[2]/div[3]/div/button')
  await submitPsp.click()
}

export const fillPaypalAuth = async paypalCredentials => {
  const usernameInput = '#email';
  const pwInput = '#password';
  const loginButtonId = '#btnLogin';
  const paypalUsername = await page.waitForSelector(usernameInput, {timeout: 5000});
  await page.click(paypalUsername, { clickCount: 3 });
  await page.keyboard.type(paypalCredentials.username);
  const paypalPW = await page.waitForSelector(pwInput, {timeout: 5000});
  await page.click(paypalPW, { clickCount: 3 });
  await page.keyboard.type(paypalCredentials.password);
  const loginButton = await page.waitForSelector(loginButtonId, {timeout: 5000});
  await page.click(loginButton);
  await page.waitForNavigation();
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
    if(outcome == null) {
      return -1;
    }
    return parseInt(outcome)
}
