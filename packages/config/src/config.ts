import { appConfigSchema, type AppConfig } from './schema';

/** The deployed web app. Used when no app URL is configured outside development. */
export const PRODUCTION_APP_URL = 'https://soundscape-web-one.vercel.app';

const DEVELOPMENT_APP_URL = 'http://localhost:3000';
const DEVELOPMENT_API_BASE_URL = 'http://localhost:4000/api';

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

/** Treat unset and blank values alike, so `FOO=` in an env file means "not set". */
export function optionalString(value: string | undefined | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function createConfig(options: CreateConfigOptions = {}): AppConfig {
  const environment = options.environment ?? 'development';
  const isDevelopment = environment === 'development' || environment === 'test';

  const configCandidate: AppConfig = {
    environment,
    runtime: options.runtime ?? 'server',
    // Never fall back to localhost outside development: a production build
    // that silently points at localhost looks fine but cannot work.
    appUrl: optionalString(options.appUrl) ?? (isDevelopment ? DEVELOPMENT_APP_URL : PRODUCTION_APP_URL),
    apiBaseUrl: optionalString(options.apiBaseUrl) ?? (isDevelopment ? DEVELOPMENT_API_BASE_URL : undefined),
    assetBaseUrl: optionalString(options.assetBaseUrl),
    cdnBucketUrl: optionalString(options.cdnBucketUrl),
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
    appUrl: optionalString(overrides.appUrl) ?? base.appUrl,
    apiBaseUrl: optionalString(overrides.apiBaseUrl) ?? base.apiBaseUrl,
    assetBaseUrl: optionalString(overrides.assetBaseUrl) ?? base.assetBaseUrl,
    cdnBucketUrl: optionalString(overrides.cdnBucketUrl) ?? base.cdnBucketUrl,
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

/** Parse a JSON object of feature flags; anything malformed yields no flags. */
export function parseFeatureFlags(raw: unknown): Record<string, boolean> {
  if (typeof raw !== 'string' || !raw.trim()) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>).map(([key, value]) => [key, Boolean(value)])
      );
    }
  } catch (error) {
    console.warn('Failed to parse feature flags JSON value', error);
  }

  return {};
}
