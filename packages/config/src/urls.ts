import type { AppConfig } from './schema';

export function trimTrailingSlash(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

export function ensureLeadingSlash(value: string) {
  return value.startsWith('/') ? value : `/${value}`;
}

export function buildApiUrl(config: AppConfig, path: string) {
  if (!config.apiBaseUrl) {
    throw new Error('No API base URL is configured');
  }
  return `${trimTrailingSlash(config.apiBaseUrl)}${ensureLeadingSlash(path)}`;
}

export function buildAppUrl(config: AppConfig, path: string) {
  if (!config.appUrl) {
    throw new Error('No app URL is configured');
  }
  return `${trimTrailingSlash(config.appUrl)}${ensureLeadingSlash(path)}`;
}

/**
 * Resolve a static asset. With no asset or CDN origin configured the path stays
 * relative, so web builds load assets from whatever host serves the page.
 */
export function buildAssetUrl(config: AppConfig, path: string) {
  const base = config.assetBaseUrl ?? config.cdnBucketUrl;
  return base ? `${trimTrailingSlash(base)}${ensureLeadingSlash(path)}` : ensureLeadingSlash(path);
}
