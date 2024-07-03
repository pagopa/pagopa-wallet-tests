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
  const radioButtonIntesa = await page.waitForSelector('#BCITITMM')
  await radioButtonIntesa.click()
  const submitPsp = await page.waitForSelector('#apmSubmit')
  await submitPsp.click()
}

export const fillPaypalAuth = async paypalCredentials => {
  const usernameInput = '#email';
  const btnNext = '#btnNext';
  //const pwInputContainer = '#login_passworddiv';
  const pwInput = '#password';
  const loginButton = '#btnLogin';
  const payButton = '#consentButton';

  const targets = await browser.targets()
  const popup = await targets[targets.length -1].page()
  await popup.waitForNavigation()
  await popup.waitForSelector(usernameInput, {timeout: 10000});
  await popup.click(usernameInput, { clickCount: 3 });
  await popup.keyboard.type(paypalCredentials.username);
  await popup.waitForSelector(btnNext, {timeout: 10000});
  await popup.click(btnNext);
  //await popup.waitForSelector(pwInputContainer, {timeout: 10000});
  await popup.waitForSelector(pwInput, {timeout: 10000});
  await new Promise(r => setTimeout(r, 2000));
  await popup.focus(pwInput);
  await new Promise(r => setTimeout(r, 2000));
  popup.keyboard.type(paypalCredentials.password);
  await new Promise(r => setTimeout(r, 2000)); 
  const login = await popup.waitForSelector(loginButton, {timeout: 10000, visible: true});
  await new Promise(r => setTimeout(r, 2000)); 
  await login.click();
  await popup.waitForFunction(`window.location.href.includes("https://www.sandbox.paypal.com/webapps/hermes")`);
  await popup.waitForSelector(payButton, {timeout: 10000});
  await new Promise(r => setTimeout(r, 2000)); 
  await popup.click(payButton);
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

export const cleantWalletOnboarded = async (walletHost, walletId) => {
  const walletToken = WALLET_TOKEN
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
      const sessionToken = sessionData.token;
      const urlPostWallet = `${walletHost}/io-payment-wallet/v1/wallets/${walletId}`;
      const responsePostWallet = await fetch(urlPostWallet, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionToken}`
        }
      });
      if(responsePostWallet.status === 204) {
        console.debug("Wallet deleted 204");
      } else {
        throw Error('Error deleting wallet');
      }
  } else {
    throw Error('Error starting session');
  }
}