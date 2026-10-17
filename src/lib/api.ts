import { create, isAxiosError, type InternalAxiosRequestConfig } from 'axios';
import { tokenStorage } from '@/lib/token-storage';
import type { StoredSession } from '@/lib/session-storage';

export const api = create({
  baseURL: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000/api/v1',
  timeout: 15_000,
  headers: { Accept: 'application/json' },
});

let unauthorizedHandler: (() => void) | null = null;
let refreshFlight: { token: string; promise: Promise<string | null> } | null = null;
let lastRotation: { from: string; to: string } | null = null;

async function refreshSession(token: string): Promise<string | null> {
  if (refreshFlight?.token === token) return refreshFlight.promise;
  const promise = (async () => {
    const refreshToken = await tokenStorage.getRefresh();
    if (!refreshToken || await tokenStorage.get() !== token) return null;
    const result = await api.post<StoredSession>('/auth/refresh', { refresh_token: refreshToken });
    if (!result.data.access_token || !result.data.refresh_token) throw new Error('Invalid refresh response');
    if (!await tokenStorage.replace(token, result.data)) return null;
    lastRotation = { from: token, to: result.data.access_token };
    return result.data.access_token;
  })();
  refreshFlight = { token, promise };
  try { return await promise; }
  finally { if (refreshFlight?.promise === promise) refreshFlight = null; }
}
export function onUnauthorized(handler: () => void): () => void {
  unauthorizedHandler = handler;
  return () => { if (unauthorizedHandler === handler) unauthorizedHandler = null; };
}

api.interceptors.request.use(async (config) => {
  const token = await tokenStorage.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use((response) => response, async (error) => {
  const config = error.config as (InternalAxiosRequestConfig & { coreRetried?: boolean }) | undefined;
  const path = config?.url;
  if (error.response?.status === 401 && config && !['/auth/login', '/auth/register', '/auth/refresh', '/auth/google/start', '/auth/google/finish'].includes(path ?? '')) {
    // A delayed response from the previous account must not log out a newer session.
    try {
      const current = await tokenStorage.get();
      if (!config.coreRetried && current && lastRotation?.to === current && config.headers.Authorization === `Bearer ${lastRotation.from}`) {
        config.coreRetried = true;
        config.headers.Authorization = `Bearer ${current}`;
        return api.request(config);
      }
      if (current && config.headers?.Authorization === `Bearer ${current}`) {
        if (!config.coreRetried) {
          try {
            const next = await refreshSession(current);
            if (next && await tokenStorage.get() === next) {
              config.coreRetried = true;
              config.headers.Authorization = `Bearer ${next}`;
              return api.request(config);
            }
          } catch (refreshError) {
            // Offline/temporary failures keep the session available for retry.
            if (!isAxiosError(refreshError) || refreshError.response?.status !== 401) return Promise.reject(refreshError);
          }
        }
        if (await tokenStorage.get() === current) unauthorizedHandler?.();
      }
    } catch { /* Keep the original API error if secure storage is unavailable. */ }
  }
  return Promise.reject(error);
});

export const authToken = tokenStorage;
