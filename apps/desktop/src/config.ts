import { createConfig, environmentNameSchema } from '@soundscape/config';

const environment = (() => {
  const candidate = process.env.SOUNDSCAPE_ENV ?? process.env.NODE_ENV ?? 'development';
  const result = environmentNameSchema.safeParse(candidate);
  return result.success ? result.data : 'development';
})();

function parseFeatureFlags(payload: string | undefined) {
  if (!payload) {
    return {};
  }

  try {
    const parsed = JSON.parse(payload) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, Boolean(value)]));
  } catch (error) {
    console.warn('Failed to parse feature flags', error);
    return {};
  }
}

export const appConfig = createConfig({
  environment,
  runtime: 'desktop',
  appUrl: process.env.SOUNDSCAPE_APP_URL,
  apiBaseUrl: process.env.SOUNDSCAPE_API_URL,
  assetBaseUrl: process.env.SOUNDSCAPE_ASSET_URL,
  cdnBucketUrl: process.env.SOUNDSCAPE_CDN_URL,
  featureFlags: parseFeatureFlags(process.env.SOUNDSCAPE_FEATURE_FLAGS)
});
