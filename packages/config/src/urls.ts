import type { AppConfig } from './schema';

export function trimTrailingSlash(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

export function ensureLeadingSlash(value: string) {
  return value.startsWith('/') ? value : `/${value}`;
}

export function buildApiUrl(config: AppConfig, path: string) {
  return `${trimTrailingSlash(config.apiBaseUrl)}${ensureLeadingSlash(path)}`;
}

export function buildAppUrl(config: AppConfig, path: string) {
  const base = config.appUrl ?? config.apiBaseUrl;
  return `${trimTrailingSlash(base)}${ensureLeadingSlash(path)}`;
}

export function buildAssetUrl(config: AppConfig, path: string) {
  const base = config.assetBaseUrl ?? config.cdnBucketUrl ?? config.appUrl ?? config.apiBaseUrl;
  return `${trimTrailingSlash(base)}${ensureLeadingSlash(path)}`;
}
