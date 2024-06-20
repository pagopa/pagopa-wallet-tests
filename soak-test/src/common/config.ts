import { NonEmptyString, WithinRangeString } from "@pagopa/ts-commons/lib/strings";
import { IntegerFromString, NumberFromString, WithinRangeNumber } from "@pagopa/ts-commons/lib/numbers";
import { BooleanFromString } from "@pagopa/ts-commons/lib/booleans";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import * as E from "fp-ts/lib/Either";
import * as t from "io-ts";
import { pipe } from "fp-ts/lib/function";

export const K6Config = t.interface({
  rate: IntegerFromString,
  duration: NonEmptyString,
  rampingDuration: NonEmptyString,
  preAllocatedVUs: IntegerFromString,
  maxVUs: IntegerFromString,
});
export type K6Config = t.TypeOf<typeof K6Config>;

export type IConfig = t.TypeOf<typeof IConfig>;
export const IConfig = t.intersection([
  t.interface({
    URL_BASE_PATH: NonEmptyString,
    API_SUBSCRIPTION_KEY: NonEmptyString,
    API_SUBSCRIPTION_KEY_GENERATE_CONTRACT: NonEmptyString,
    URL_BASE_PATH_GENERATE_CONTRACT: NonEmptyString,
  }),
  t.partial({
    API_ENVIRONMENT: NonEmptyString,
    WALLET_TOKEN: NonEmptyString,
    DELETE_RATIO: NumberFromString.pipe(WithinRangeNumber(0.0, 1.0)),
    ONBOARD_APM_RATIO: NumberFromString,
  }),
  K6Config,
]);

// No need to re-evaluate this object for each call
const errorOrConfig: t.Validation<IConfig> = IConfig.decode({
  ...__ENV,
});

/**
 * Read the application configuration and check for invalid values.
 * Configuration is eagerly evalued when the application starts.
 *
 * @returns either the configuration values or a list of validation errors
 */
// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function getConfig(): t.Validation<IConfig> {
  return errorOrConfig;
}

/**
 * Read the application configuration and check for invalid values.
 * If the application is not valid, raises an exception.
 *
 * @returns the configuration values
 * @throws validation errors found while parsing the application configuration
 */
// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function getConfigOrThrow(): IConfig {
  return pipe(
    errorOrConfig,
    E.getOrElseW((errors) => {
      throw new Error(`Invalid configuration: ${readableReport(errors)}`);
    })
  );
}

export const getVersionedBaseUrl = (baseUrl: string, version: string): string => {
  const versionRegex = /\/v\d/gm;
  return versionRegex.test(baseUrl) ? 
        baseUrl : 
        (baseUrl.endsWith("/") ? `${baseUrl}${version}` : `${baseUrl}/${version}`);
}