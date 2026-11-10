import { createConfig, environmentNameSchema, parseFeatureFlags } from '@soundscape/config';

const resolvedEnvironment =
  environmentNameSchema.safeParse(process.env.NEXT_PUBLIC_ENV ?? process.env.NODE_ENV).data ?? 'development';

export const appConfig = createConfig({
  environment: resolvedEnvironment,
  runtime: 'web',
  appUrl: process.env.NEXT_PUBLIC_APP_URL,
  assetBaseUrl: process.env.NEXT_PUBLIC_ASSET_URL,
  cdnBucketUrl: process.env.NEXT_PUBLIC_CDN_URL,
  featureFlags: parseFeatureFlags(process.env.NEXT_PUBLIC_FEATURE_FLAGS)
});

/**
 * Origin for share links: the configured app URL if one is set, otherwise the
 * site the visitor is on (so preview deployments share preview links).
 */
export function getShareOrigin() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return appConfig.appUrl ?? '';
}
