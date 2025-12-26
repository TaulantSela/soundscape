import Constants from 'expo-constants';
import { createConfig, environmentNameSchema } from '@soundscape/config';

const extra = Constants.expoConfig?.extra ?? {};

const environment = (() => {
  const candidate = extra.environment ?? 'development';
  const result = environmentNameSchema.safeParse(candidate);
  return result.success ? result.data : 'development';
})();

function parseFeatureFlags(flags: unknown) {
  if (!flags || typeof flags !== 'string') {
    return {};
  }

  try {
    const parsed = JSON.parse(flags) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, Boolean(value)]));
  } catch (error) {
    console.warn('Failed to parse feature flags', error);
    return {};
  }
}

export const appConfig = createConfig({
  environment,
  runtime: 'mobile',
  appUrl: typeof extra.appUrl === 'string' ? extra.appUrl : undefined,
  apiBaseUrl: typeof extra.apiBaseUrl === 'string' ? extra.apiBaseUrl : undefined,
  assetBaseUrl: typeof extra.assetBaseUrl === 'string' ? extra.assetBaseUrl : undefined,
  cdnBucketUrl: typeof extra.cdnBucketUrl === 'string' ? extra.cdnBucketUrl : undefined,
  featureFlags: parseFeatureFlags(extra.featureFlags)
});
