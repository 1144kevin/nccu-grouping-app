import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { coreApi, type CoreSession } from '@/lib/core-api';
import { beginGoogleSignIn, clearGoogleCallback, finishGoogleSignIn } from './google-login.web';
import { GOOGLE_CALLBACK } from './google-oauth';

jest.mock('@/lib/core-api', () => ({ coreApi: { googleStart: jest.fn(), googleFinish: jest.fn() } }));

const key = 'nccu-grouping.google-web.flow';
const flowId = 'f'.repeat(43);
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
let storage: Map<string, string>;
let browser: { location: { origin: string; href: string; assign: ReturnType<typeof jest.fn> }; history: { replaceState: ReturnType<typeof jest.fn> }; sessionStorage: { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void; removeItem: (key: string) => void } };

beforeEach(() => {
  jest.resetAllMocks(); clearGoogleCallback(); storage = new Map();
  browser = {
    location: { origin: 'http://localhost:8081', href: GOOGLE_CALLBACK + '?code=synthetic-code', assign: jest.fn() },
    history: { replaceState: jest.fn() },
    sessionStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => { storage.set(key, value); }, removeItem: (key) => { storage.delete(key); } },
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
  expect(browser.history.replaceState).toHaveBeenCalledWith(null, '', GOOGLE_CALLBACK);
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
