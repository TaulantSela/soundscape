import { describe, expect, it, vi } from 'vitest';
import { PRODUCTION_APP_URL, createConfig, parseFeatureFlags } from './config';
import { buildApiUrl, buildAppUrl, buildAssetUrl } from './urls';

describe('createConfig', () => {
  it('treats blank URLs as unset instead of failing validation', () => {
    const config = createConfig({ environment: 'production', cdnBucketUrl: '', assetBaseUrl: '  ' });
    expect(config.cdnBucketUrl).toBeUndefined();
    expect(config.assetBaseUrl).toBeUndefined();
  });

  it('never points a production build at localhost', () => {
    const config = createConfig({ environment: 'production' });
    expect(config.appUrl).toBe(PRODUCTION_APP_URL);
    expect(config.apiBaseUrl).toBeUndefined();
    expect(() => buildApiUrl(config, '/mixes')).toThrow(/No API base URL/);
  });

  it('uses local servers in development', () => {
    const config = createConfig({ environment: 'development' });
    expect(buildAppUrl(config, 'mix')).toBe('http://localhost:3000/mix');
    expect(buildApiUrl(config, '/health')).toBe('http://localhost:4000/api/health');
  });

  it('keeps asset paths relative unless an asset origin is configured', () => {
    expect(buildAssetUrl(createConfig({ environment: 'production' }), 'audio/rain.mp3')).toBe('/audio/rain.mp3');
    expect(buildAssetUrl(createConfig({ assetBaseUrl: 'https://cdn.example.com/' }), '/audio/rain.mp3')).toBe(
      'https://cdn.example.com/audio/rain.mp3'
    );
  });
});

describe('parseFeatureFlags', () => {
  it('coerces values to booleans and ignores malformed input', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(parseFeatureFlags('{"a":1,"b":0}')).toEqual({ a: true, b: false });
    expect(parseFeatureFlags('[1,2]')).toEqual({});
    expect(parseFeatureFlags('{oops')).toEqual({});
    expect(parseFeatureFlags(undefined)).toEqual({});
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
