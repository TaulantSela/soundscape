import { buildApiUrl } from '@soundscape/config';
import { appConfig } from './config';
import type { MixPayload, MixResponse } from './types';

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}) {
  const url = buildApiUrl(appConfig, path);
  const response = await fetch(url, {
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
      body: JSON.stringify(payload),
      skipAuth: false
    });
  },
  fetchMix(id: string) {
    return request<MixResponse>(`/mixes/${id}`, {
      method: 'GET',
      skipAuth: true
    });
  }
};
