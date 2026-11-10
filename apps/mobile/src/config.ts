import {
  PRODUCTION_APP_URL,
  createConfig,
  environmentNameSchema,
  parseFeatureFlags,
} from '@soundscape/config';
import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;

function stringOrUndefined(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}

const environment = environmentNameSchema.safeParse(extra.environment).data ?? 'development';

export const appConfig = createConfig({
  environment,
  runtime: 'mobile',
  // Share links must open on other devices, so never default to localhost
  // (on a phone that is the phone itself).
  appUrl: stringOrUndefined(extra.appUrl) || PRODUCTION_APP_URL,
  apiBaseUrl: stringOrUndefined(extra.apiBaseUrl),
  assetBaseUrl: stringOrUndefined(extra.assetBaseUrl),
  cdnBucketUrl: stringOrUndefined(extra.cdnBucketUrl),
  featureFlags: parseFeatureFlags(extra.featureFlags),
});
