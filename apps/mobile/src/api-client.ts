import { buildApiUrl } from '@soundscape/config';
import { appConfig } from './config';
import type { MixPayload, MixResponse } from './types';

type RequestOptions = RequestInit & { skipAuth?: boolean };

async function request<T>(path: string, options: RequestOptions = {}) {
  if (!appConfig.apiBaseUrl) {
    throw new Error('Missing API base URL');
  }

  const response = await fetch(buildApiUrl(appConfig, path), {
    ...options,
    credentials: options.skipAuth ? 'omit' : 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {})
    }
  });

  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : undefined;

  if (!response.ok) {
    const message = (data as { message?: string } | undefined)?.message ?? 'Request failed';
    throw new Error(message);
  }

  return data as T;
}

export const apiClient = {
  createMix(payload: MixPayload) {
    return request<MixResponse>('/mixes', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }
};
