import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { coreApi, type CoreSession } from '@/lib/core-api';
import { beginGoogleSignIn, clearGoogleCallback, finishGoogleSignIn } from './google-login.web';
import { GOOGLE_CALLBACK } from './google-oauth';

jest.mock('@/lib/core-api', () => ({
  coreApi: { googleStart: jest.fn(), googleFinish: jest.fn() },
}));

const key = 'nccu-grouping.google-web.flow';
const flowId = 'f'.repeat(43);
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
let storage: Map<string, string>;
let browser: {
  location: { origin: string; href: string; assign: ReturnType<typeof jest.fn> };
  history: { state: object; replaceState: ReturnType<typeof jest.fn> };
  sessionStorage: {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
    removeItem: (key: string) => void;
  };
};

beforeEach(() => {
  jest.resetAllMocks();
  clearGoogleCallback();
  storage = new Map();
  browser = {
    location: {
      origin: 'http://localhost:8081',
      href: GOOGLE_CALLBACK + '?code=synthetic-code',
      assign: jest.fn(),
    },
    history: { state: { key: 'router-history-entry', index: 2 }, replaceState: jest.fn() },
    sessionStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => {
        storage.set(key, value);
      },
      removeItem: (key) => {
        storage.delete(key);
      },
    },
  };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: browser });
});

afterEach(() => {
  clearGoogleCallback();
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
  else Reflect.deleteProperty(globalThis, 'window');
});

it('does not redirect or save proof when the provider has not been configured', async () => {
  jest.mocked(coreApi.googleStart).mockRejectedValue(new Error('google_login_not_configured'));
  await expect(beginGoogleSignIn()).rejects.toThrow('google_login_not_configured');
  expect(browser.location.assign).not.toHaveBeenCalled();
  expect(storage.size).toBe(0);
});

it('shares code exchange across effect replays and deletes browser proof and query data', async () => {
  storage.set(key, flowId);
  const session = { access_token: 'synthetic-token' } as CoreSession;
  jest.mocked(coreApi.googleFinish).mockResolvedValue(session);
  const first = finishGoogleSignIn();
  const second = finishGoogleSignIn();
  expect(first).toBe(second);
  await expect(first).resolves.toEqual(session);
  expect(coreApi.googleFinish).toHaveBeenCalledTimes(1);
  expect(coreApi.googleFinish).toHaveBeenCalledWith(flowId, 'synthetic-code');
  expect(storage.has(key)).toBe(false);
  expect(browser.history.replaceState).toHaveBeenCalledWith(
    browser.history.state,
    '',
    GOOGLE_CALLBACK,
  );
});

it('rejects a missing proof without exchanging a supplied code', async () => {
  await expect(finishGoogleSignIn()).rejects.toThrow('google_login_expired_restart');
  expect(coreApi.googleFinish).not.toHaveBeenCalled();
});

it('handles cancellation without echoing provider descriptions or retaining proof', async () => {
  browser.location.href = GOOGLE_CALLBACK + '?error=access_denied&error_description=private-value';
  storage.set(key, flowId);
  await expect(finishGoogleSignIn()).rejects.toThrow('google_login_cancelled');
  expect(coreApi.googleFinish).not.toHaveBeenCalled();
  expect(storage.size).toBe(0);
});

it('starts and completes public HTTPS login with same-tab proof and the public client', async () => {
  const previous = process.env.EXPO_PUBLIC_APP_PROFILE;
  try {
    process.env.EXPO_PUBLIC_APP_PROFILE = 'web';
    const origin = 'https://campus-demo.trycloudflare.com';
    const callback = `${origin}/auth/callback`;
    browser.location.origin = origin;
    browser.location.href = `${callback}?code=synthetic-public-code`;
    let publicLogin!: typeof import('./google-login.web');
    let publicApi!: typeof coreApi;
    jest.isolateModules(() => {
      publicLogin = jest.requireActual<typeof import('./google-login.web')>('./google-login.web');
      publicApi = jest.requireMock<typeof import('./core-api')>('./core-api').coreApi;
    });
    const authorize = new URL('https://axdwbfhrkbovgrbngrrh.supabase.co/auth/v1/authorize');
    authorize.search = new URLSearchParams({
      provider: 'google',
      redirect_to: callback,
      code_challenge_method: 's256',
      code_challenge: 'c'.repeat(43),
    }).toString();
    jest.mocked(publicApi.googleStart).mockResolvedValue({
      authorize_url: authorize.href,
      flow_id: flowId,
      expires_in: 600,
    });
    const session = { access_token: 'synthetic-token' } as CoreSession;
    jest.mocked(publicApi.googleFinish).mockResolvedValue(session);
    await publicLogin.beginGoogleSignIn();
    expect(publicApi.googleStart).toHaveBeenCalledWith('web_public');
    expect(storage.get(key)).toBe(flowId);
    expect(browser.location.assign).toHaveBeenCalledWith(authorize.href);
    await expect(publicLogin.finishGoogleSignIn()).resolves.toEqual(session);
    expect(publicApi.googleFinish).toHaveBeenCalledWith(flowId, 'synthetic-public-code');
    expect(storage.has(key)).toBe(false);
    expect(browser.history.replaceState).toHaveBeenCalledWith(browser.history.state, '', callback);
  } finally {
    if (previous === undefined) delete process.env.EXPO_PUBLIC_APP_PROFILE;
    else process.env.EXPO_PUBLIC_APP_PROFILE = previous;
  }
});
