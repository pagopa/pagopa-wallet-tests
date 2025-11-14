# pagopa-wallet-tests

This repository contains both api test and e2e test 
used to perform integration tests for Wallet products.

Tests can be found under api-tests and e2e folders.

Api tests consists of postman collections that can be run using newman using the following command

## Run end-to-end locally

End-to-end tests are executed using puppeteers.
Test execution will launch a Chrome instance locally and simulate user interactions and perform checks
against expected front end behaviour.

Tests have been split for DEV and UAT environment since those environment use different inputs (card number, f.e)
Test can be run using the following script:
```sh
cd e2e-tests
rm -f .env && cp <environment>.env .env
yarn install && yarn test
```
Make sure locally node version matches the `./e2e-tests/.nvmrc` ones.

If you have `nvm` this can be done with the following command:
```sh
cd e2e-tests && nvm use
```

In order to run tests for dev environment the above command will become:
```sh
cd e2e-tests
rm -f .env && cp dev.env .env
yarn install && yarn test
```

Tests are executed in `headless` mode, meaning that no Chrome window will be visible during test execution.

During tests writing, or to investigate tests failure, enabling visual mode can be useful.

This can be achieved modifying the `./e2e-tests/jest-puppeteer.config.js` file disabling `headless` parameter.

This configuration file will become:

```
module.exports = {
    launch: {
        dumpio: true,
        headless: false, //--> change here from true to false
        product: 'chrome',
        args: ["--no-sandbox"] 
    },
    browserContext: 'incognito'
}
```

### Playwright Setup

Playwright infrastructure has been added for new E2E tests. Run `yarn pw:install` in `e2e-tests/` to install browsers.

## Execute end-to-end tests in azure pipelines

This project contains a template that can be used to execute end-to-end tests during azure pipeline execution.
For example, those tests have been included into infra eCommerce domain IAC pipeline after a domain-app apply.

Template is stored under `.devops/azure-templates/e2e-tests.yaml`

For pipeline integration first is required to pagopa/pagopa-wallet-tests repository checkout.

This can be done adding this repo to pipeline resources with:

```yaml
resources:
  repositories:
    - repository: walletTests
      type: github
      name: pagopa/pagopa-wallet-tests
      ref: main
      endpoint: 'endpoint configuration'
```

The repository used name, then, will be used as `CHECKOUT_RESOURCE_REPO_NAME` parameter value

Once add this repository to pipeline repository section, e2e test template can be used as follows:

```yaml
  - stage: E2E_Tests_Wallet
    pool:
      vmImage: 'ubuntu-latest'
    dependsOn: Setup_Project
    jobs:
      - job: e2e_tests
        steps:
          - template: .devops/azure-templates/e2e-tests.yaml@walletTests
            parameters:
              ENVIRONMENT: DEV
              CHECKOUT_RESOURCE_REPO_NAME: walletTests
```
for perform e2e test for DEV environment.

Template parameters:

| Parameter key                | Type   | Description                                             |
|------------------------------|--------|---------------------------------------------------------|
| ENVIRONMENT                  | string | Environment for which execute e2e test (DEV or UAT)     |
| CHECKOUT_RESOURCE_REPO_NAME  | string | The name used during wallet-tests repository checkout |

## Soak tests
### Migration tests
Every step of migration test will generate a new contract id by calling PUT /migrations/wallets and then
will update or delete the wallet using POST /migrations/updateDetails or POST /migrations/delete.

| Parameter key                          | Type   | Description                                              |
|----------------------------------------|--------|----------------------------------------------------------|
| API_SUBSCRIPTION_KEY                   | string | API key used to finalize contract import                 |
| URL_BASE_PATH                          | string | URL base path to import contract api group               |
| API_SUBSCRIPTION_KEY_GENERATE_CONTRACT | string | API key used by generating contract                      |
| URL_BASE_PATH_GENERATE_CONTRACT        | string | URL base path to generate contract api group             |
| MIGRATION_DELETE_RATIO                 | number | Between 0 and 1. The percentage of contract DELETE       |
| ONBOARD_APM_RATIO                      | number | Between 0 and 1. The percentage of Paypal wallet onboard |

