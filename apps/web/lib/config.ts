import { createConfig, environmentNameSchema } from '@soundscape/config';

const resolvedEnvironment = (() => {
  const candidate = process.env.NEXT_PUBLIC_ENV ?? process.env.NODE_ENV ?? 'development';
  try {
    return environmentNameSchema.parse(candidate);
  } catch {
    return 'development';
  }
})();

export const appConfig = createConfig({
  environment: resolvedEnvironment,
  runtime: 'web',
  appUrl: process.env.NEXT_PUBLIC_APP_URL,
  apiBaseUrl: process.env.NEXT_PUBLIC_API_URL,
  assetBaseUrl: process.env.NEXT_PUBLIC_ASSET_URL,
  cdnBucketUrl: process.env.NEXT_PUBLIC_CDN_URL,
  featureFlags: parseFeatureFlags(process.env.NEXT_PUBLIC_FEATURE_FLAGS)
});

function parseFeatureFlags(flags: string | undefined) {
  if (!flags) {
    return {};
  }

  try {
    const parsed = JSON.parse(flags) as Record<string, unknown>;
    return Object.keys(parsed).reduce<Record<string, boolean>>((acc, key) => {
      acc[key] = Boolean(parsed[key]);
      return acc;
    }, {});
  } catch (error) {
    console.warn('Failed to parse feature flag payload', error);
    return {};
  }
}
