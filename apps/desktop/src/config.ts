import { app } from 'electron';
import { createConfig, environmentNameSchema, parseFeatureFlags } from '@soundscape/config';

// Packaged apps get no environment variables from a shell, so the packaged
// build is production by definition.
const environment = app.isPackaged
  ? 'production'
  : environmentNameSchema.safeParse(process.env.SOUNDSCAPE_ENV ?? process.env.NODE_ENV).data ?? 'development';

export const appConfig = createConfig({
  environment,
  runtime: 'desktop',
  appUrl: process.env.SOUNDSCAPE_APP_URL,
  apiBaseUrl: process.env.SOUNDSCAPE_API_URL,
  assetBaseUrl: process.env.SOUNDSCAPE_ASSET_URL,
  cdnBucketUrl: process.env.SOUNDSCAPE_CDN_URL,
  featureFlags: parseFeatureFlags(process.env.SOUNDSCAPE_FEATURE_FLAGS)
});
