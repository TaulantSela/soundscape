import { appConfigSchema, type AppConfig } from './schema';

const DEFAULT_API_BASE_URL = 'http://localhost:4000/api';
const DEFAULT_APP_URL = 'http://localhost:3000';

export interface CreateConfigOptions {
  environment?: AppConfig['environment'];
  runtime?: AppConfig['runtime'];
  appUrl?: string;
  apiBaseUrl?: string;
  assetBaseUrl?: string;
  cdnBucketUrl?: string;
  build?: AppConfig['build'];
  mix?: Partial<AppConfig['mix']>;
  auth?: Partial<AppConfig['auth']>;
  featureFlags?: AppConfig['featureFlags'];
}

export function createConfig(options: CreateConfigOptions = {}): AppConfig {
  const configCandidate: AppConfig = {
    environment: options.environment ?? 'development',
    runtime: options.runtime ?? 'server',
    appUrl: options.appUrl ?? DEFAULT_APP_URL,
    apiBaseUrl: options.apiBaseUrl ?? DEFAULT_API_BASE_URL,
    assetBaseUrl: options.assetBaseUrl ?? options.appUrl ?? DEFAULT_APP_URL,
    cdnBucketUrl: options.cdnBucketUrl,
    build: {
      revision: options.build?.revision,
      timestamp: options.build?.timestamp
    },
    mix: {
      defaultFadeMs: options.mix?.defaultFadeMs ?? 200,
      defaultMasterVolume: options.mix?.defaultMasterVolume ?? 0.8
    },
    auth: {
      storageKey: options.auth?.storageKey ?? 'soundscape.auth',
      refreshIntervalMinutes: options.auth?.refreshIntervalMinutes ?? 15
    },
    featureFlags: options.featureFlags ?? {}
  };

  return appConfigSchema.parse(configCandidate);
}

export function mergeConfig(base: AppConfig, overrides: CreateConfigOptions = {}): AppConfig {
  return createConfig({
    environment: overrides.environment ?? base.environment,
    runtime: overrides.runtime ?? base.runtime,
    appUrl: overrides.appUrl ?? base.appUrl,
    apiBaseUrl: overrides.apiBaseUrl ?? base.apiBaseUrl,
    assetBaseUrl: overrides.assetBaseUrl ?? base.assetBaseUrl,
    cdnBucketUrl: overrides.cdnBucketUrl ?? base.cdnBucketUrl,
    build: {
      revision: overrides.build?.revision ?? base.build.revision,
      timestamp: overrides.build?.timestamp ?? base.build.timestamp
    },
    mix: {
      defaultFadeMs: overrides.mix?.defaultFadeMs ?? base.mix.defaultFadeMs,
      defaultMasterVolume: overrides.mix?.defaultMasterVolume ?? base.mix.defaultMasterVolume
    },
    auth: {
      storageKey: overrides.auth?.storageKey ?? base.auth.storageKey,
      refreshIntervalMinutes:
        overrides.auth?.refreshIntervalMinutes ?? base.auth.refreshIntervalMinutes
    },
    featureFlags: overrides.featureFlags ?? base.featureFlags
  });
}
