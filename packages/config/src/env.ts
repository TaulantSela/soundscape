import { z } from 'zod';
import { createConfig, type CreateConfigOptions } from './config';
import { environmentNameSchema, runtimeTargetSchema } from './schema';

const envVarSchema = z.object({
  NODE_ENV: environmentNameSchema.optional(),
  RUNTIME_TARGET: runtimeTargetSchema.optional(),
  PUBLIC_APP_URL: z.string().optional(),
  PUBLIC_API_URL: z.string().optional(),
  PUBLIC_ASSET_URL: z.string().optional(),
  PUBLIC_CDN_URL: z.string().optional(),
  MIX_DEFAULT_FADE_MS: z.string().optional(),
  MIX_DEFAULT_MASTER: z.string().optional(),
  AUTH_STORAGE_KEY: z.string().optional(),
  AUTH_REFRESH_INTERVAL: z.string().optional(),
  FEATURE_FLAGS: z.string().optional(),
  BUILD_REVISION: z.string().optional(),
  BUILD_TIMESTAMP: z.string().optional()
});

export function loadConfigFromEnv(
  envVars: Record<string, string | undefined> = process.env as Record<string, string | undefined>
) {
  const parsed = envVarSchema.parse(envVars);

  const featureFlags = parseFeatureFlags(parsed.FEATURE_FLAGS);
  const mixDefaults = normalizeMixDefaults(parsed.MIX_DEFAULT_FADE_MS, parsed.MIX_DEFAULT_MASTER);
  const authDefaults = normalizeAuthDefaults(
    parsed.AUTH_STORAGE_KEY,
    parsed.AUTH_REFRESH_INTERVAL
  );

  const options: CreateConfigOptions = {
    environment: parsed.NODE_ENV,
    runtime: parsed.RUNTIME_TARGET,
    appUrl: parsed.PUBLIC_APP_URL,
    apiBaseUrl: parsed.PUBLIC_API_URL,
    assetBaseUrl: parsed.PUBLIC_ASSET_URL,
    cdnBucketUrl: parsed.PUBLIC_CDN_URL,
    build: {
      revision: parsed.BUILD_REVISION,
      timestamp: parsed.BUILD_TIMESTAMP
    },
    mix: mixDefaults,
    auth: authDefaults,
    featureFlags
  };

  return createConfig(options);
}

function parseFeatureFlags(raw: string | undefined) {
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return Object.keys(parsed).reduce<Record<string, boolean>>((acc, key) => {
        acc[key] = Boolean((parsed as Record<string, unknown>)[key]);
        return acc;
      }, {});
    }
  } catch (error) {
    console.warn('Failed to parse FEATURE_FLAGS JSON value', error);
  }

  return {};
}

function normalizeMixDefaults(fadeMs: string | undefined, masterVolume: string | undefined) {
  const mix: CreateConfigOptions['mix'] = {};

  if (fadeMs) {
    const parsed = Number.parseInt(fadeMs, 10);
    if (!Number.isNaN(parsed)) {
      mix.defaultFadeMs = parsed;
    }
  }

  if (masterVolume) {
    const parsed = Number.parseFloat(masterVolume);
    if (!Number.isNaN(parsed)) {
      mix.defaultMasterVolume = Math.min(1, Math.max(0, parsed));
    }
  }

  return mix;
}

function normalizeAuthDefaults(storageKey?: string, refreshInterval?: string) {
  const auth: CreateConfigOptions['auth'] = {};

  if (storageKey) {
    auth.storageKey = storageKey;
  }

  if (refreshInterval) {
    const parsed = Number.parseInt(refreshInterval, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      auth.refreshIntervalMinutes = parsed;
    }
  }

  return auth;
}
