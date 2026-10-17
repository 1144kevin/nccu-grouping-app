import { afterEach, expect, it, jest } from '@jest/globals';
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { api, onUnauthorized } from '@/lib/api';
import { tokenStorage } from '@/lib/token-storage';
import { coreApi, coreError, toFeedPost, type CorePost } from '@/lib/core-api';

jest.mock('@/lib/token-storage', () => ({ tokenStorage: { get: jest.fn(async () => 'synthetic-session-token'), getRefresh: jest.fn(async (): Promise<string | null> => null), replace: jest.fn(async () => true), set: jest.fn(), clear: jest.fn() } }));

const adapter = api.defaults.adapter;
afterEach(() => { api.defaults.adapter = adapter; jest.mocked(tokenStorage.get).mockResolvedValue('synthetic-session-token'); jest.mocked(tokenStorage.getRefresh).mockResolvedValue(null); jest.mocked(tokenStorage.replace).mockReset(); });

it('sends bearer authentication and retains the idempotency key for publication', async () => {
  const requests: InternalAxiosRequestConfig[] = [];
  api.defaults.adapter = async (config) => {
    requests.push(config);
    return { data: { id: 'synthetic-post' }, status: 201, statusText: 'Created', headers: {}, config };
  };
  const input = { content: '本機測試一起訂晚餐', tags: ['晚餐'], location: { name: '測試點', latitude: 24.987, longitude: 121.576 }, deadline_at: '2026-10-16T10:00:00Z', capacity: 2, price_per_person: '85.50' };
  await coreApi.create(input, 'synthetic-publication-key');
  await coreApi.create(input, 'synthetic-publication-key');
  expect(requests[0].headers.Authorization).toBe('Bearer synthetic-session-token');
  expect(requests[0].headers['Idempotency-Key']).toBe(requests[1].headers['Idempotency-Key']);
  expect(JSON.parse(requests[0].data)).toEqual(input);
});

it('uses approval and withdrawal endpoints without spoofing a user id', async () => {
  const requests: InternalAxiosRequestConfig[] = [];
  api.defaults.adapter = async (config) => {
    requests.push(config);
    return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
  };
  await coreApi.requestJoin('post-id', 2);
  await coreApi.decide('request-id', 'accepted');
  await coreApi.withdraw('post-id');
  expect(requests.map((request) => [request.method, request.url])).toEqual([
    ['post', '/posts/post-id/join-requests'], ['patch', '/join-requests/request-id'], ['delete', '/posts/post-id/membership'],
  ]);
  expect(JSON.parse(requests[1].data)).toEqual({ status: 'accepted' });
  expect(JSON.parse(requests[0].data)).toEqual({ expected_version: 2 });
});

it('maps server ownership and decimal money, preserving free versus unknown prices', () => {
  const post: CorePost = { id: 'p', author_id: 'a', author_name: '主揪', content: '晚餐拼單', tags: ['晚餐'], location: { name: '校門', latitude: 24.9, longitude: 121.5 }, price_per_person: '0.00', deadline_at: '2026-10-16T10:00:00Z', capacity: 2, joined: 1, status: 'open', my_status: 'host', created_at: '2026-10-16T08:00:00Z' };
  expect(toFeedPost(post)).toMatchObject({ pricePerPerson: 0, isMine: true, joined: 1 });
  expect(toFeedPost({ ...post, price_per_person: null, my_status: 'pending' })).toMatchObject({ pricePerPerson: undefined, isMine: false });
});

it('shows actionable errors without displaying backend response bodies', () => {
  const response = { status: 409, data: { detail: 'post_full', private: 'do-not-display' } } as AxiosResponse;
  expect(coreError(new AxiosError('failed', 'ERR_BAD_REQUEST', undefined, undefined, response))).toContain('額滿');
  expect(coreError(new AxiosError('network failure'))).toContain('本機後端');
  expect(coreError(new Error('secret-internal-details'))).not.toContain('secret');
});

it('explains rejected cloud test addresses without suggesting a server outage', () => {
  const response = { status: 400, data: { detail: 'email_address_invalid', private: 'private-email-value' } } as AxiosResponse;
  const message = coreError(new AxiosError('failed', 'ERR_BAD_REQUEST', undefined, undefined, response));
  expect(message).toContain('真實信箱');
  expect(message).toContain('離線測試');
  expect(message).not.toContain('private-email-value');
  expect(message).not.toContain('稍後重試');
});

it('invalidates expired sessions, while incorrect login passwords do not invalidate another session', async () => {
  const expired = jest.fn();
  const cleanup = onUnauthorized(expired);
  api.defaults.adapter = async (config) => { throw new AxiosError('unauthorized', 'ERR_BAD_REQUEST', config, undefined, { status: 401, config, data: {}, headers: {}, statusText: 'Unauthorized' }); };
  await expect(coreApi.login('a@example.test', 'wrong-password')).rejects.toBeInstanceOf(AxiosError);
  expect(expired).not.toHaveBeenCalled();
  await expect(coreApi.post('p')).rejects.toBeInstanceOf(AxiosError);
  expect(expired).toHaveBeenCalledTimes(1);
  cleanup();
});

it('ignores a delayed 401 from a previous account after switching sessions', async () => {
  const expired = jest.fn();
  const cleanup = onUnauthorized(expired);
  api.defaults.adapter = async (config) => {
    expect(config.headers.Authorization).toBe('Bearer synthetic-session-token');
    jest.mocked(tokenStorage.get).mockResolvedValue('new-synthetic-session-token');
    throw new AxiosError('old session expired', 'ERR_BAD_REQUEST', config, undefined, { status: 401, config, data: {}, headers: {}, statusText: 'Unauthorized' });
  };
  try {
    await expect(coreApi.post('p')).rejects.toBeInstanceOf(AxiosError);
    expect(expired).not.toHaveBeenCalled();
  } finally { cleanup(); }
});

function unauthorized(config: InternalAxiosRequestConfig) {
  return new AxiosError('unauthorized', 'ERR_BAD_REQUEST', config, undefined, { status: 401, config, data: {}, headers: {}, statusText: 'Unauthorized' });
}

it('shares one rotating refresh across concurrent requests and retries each once', async () => {
  const expired = jest.fn();
  const cleanup = onUnauthorized(expired);
  jest.mocked(tokenStorage.getRefresh).mockResolvedValue('synthetic-refresh');
  jest.mocked(tokenStorage.replace).mockImplementation(async (expected, session) => {
    expect(expected).toBe('synthetic-session-token');
    jest.mocked(tokenStorage.get).mockResolvedValue(session.access_token);
    return true;
  });
  let refreshCount = 0;
  api.defaults.adapter = async (config) => {
    if (config.url === '/auth/refresh') {
      refreshCount++;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { data: { access_token: 'rotated-access', refresh_token: 'rotated-refresh' }, status: 200, statusText: 'OK', headers: {}, config };
    }
    if (config.headers.Authorization !== 'Bearer rotated-access') throw unauthorized(config);
    return { data: { id: config.url }, status: 200, statusText: 'OK', headers: {}, config };
  };
  try {
    await Promise.all([coreApi.post('first'), coreApi.post('second')]);
    expect(refreshCount).toBe(1);
    expect(expired).not.toHaveBeenCalled();
  } finally { cleanup(); }
});

it('keeps the session on a temporary refresh outage', async () => {
  const expired = jest.fn();
  const cleanup = onUnauthorized(expired);
  jest.mocked(tokenStorage.getRefresh).mockResolvedValue('synthetic-refresh');
  api.defaults.adapter = async (config) => {
    if (config.url === '/auth/refresh') throw new AxiosError('offline', 'ERR_NETWORK', config);
    throw unauthorized(config);
  };
  try {
    await expect(coreApi.me()).rejects.toMatchObject({ code: 'ERR_NETWORK' });
    expect(expired).not.toHaveBeenCalled();
    expect(await tokenStorage.get()).toBe('synthetic-session-token');
  } finally { cleanup(); }
});

it('retries a delayed old-token 401 after another request has already rotated it', async () => {
  jest.mocked(tokenStorage.getRefresh).mockResolvedValue('synthetic-refresh');
  jest.mocked(tokenStorage.replace).mockImplementation(async (_expected, session) => {
    jest.mocked(tokenStorage.get).mockResolvedValue(session.access_token);
    return true;
  });
  let release!: () => void;
  const delayed = new Promise<void>((resolve) => { release = resolve; });
  let refreshCount = 0;
  api.defaults.adapter = async (config) => {
    if (config.url === '/auth/refresh') {
      refreshCount++;
      return { data: { access_token: 'delayed-rotation', refresh_token: 'rotated-refresh' }, status: 200, statusText: 'OK', headers: {}, config };
    }
    if (config.headers.Authorization === 'Bearer synthetic-session-token') {
      if (config.url?.endsWith('/slow')) await delayed;
      throw unauthorized(config);
    }
    return { data: { id: config.url }, status: 200, statusText: 'OK', headers: {}, config };
  };
  const fast = coreApi.post('fast');
  const slow = coreApi.post('slow');
  await fast;
  release();
  await slow;
  expect(refreshCount).toBe(1);
});

it('does not adopt a refresh result received after logout', async () => {
  const expired = jest.fn();
  const cleanup = onUnauthorized(expired);
  jest.mocked(tokenStorage.getRefresh).mockResolvedValue('synthetic-refresh');
  jest.mocked(tokenStorage.replace).mockResolvedValue(false);
  api.defaults.adapter = async (config) => {
    if (config.url === '/auth/refresh') {
      jest.mocked(tokenStorage.get).mockResolvedValue(null);
      return { data: { access_token: 'late-access', refresh_token: 'late-refresh' }, status: 200, statusText: 'OK', headers: {}, config };
    }
    throw unauthorized(config);
  };
  try {
    await expect(coreApi.me()).rejects.toBeInstanceOf(AxiosError);
    expect(await tokenStorage.get()).toBeNull();
    expect(expired).not.toHaveBeenCalled();
  } finally { cleanup(); }
});
