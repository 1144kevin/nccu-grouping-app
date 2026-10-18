import { afterAll, beforeEach, expect, jest, test } from '@jest/globals';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { coreApi } from './core-api';
import { beginGoogleSignIn, clearGoogleCallback, finishGoogleSignIn } from './google-login';
import { GOOGLE_IOS_CALLBACK } from './google-oauth';

jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn() }));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { executionEnvironment: 'standalone' },
}));
jest.mock('@/lib/core-api', () => ({
  coreApi: { googleStart: jest.fn(), googleFinish: jest.fn() },
}));
const originalOS = Platform.OS;
const flowId = 'f'.repeat(43);
const session = { access_token: 'synthetic-token' } as Awaited<
  ReturnType<typeof coreApi.googleFinish>
>;
const parameters = new URLSearchParams({
  provider: 'google',
  redirect_to: GOOGLE_IOS_CALLBACK,
  code_challenge_method: 's256',
  code_challenge: 'c'.repeat(43),
});
const authorize = `https://axdwbfhrkbovgrbngrrh.supabase.co/auth/v1/authorize?${parameters}`;

beforeEach(() => {
  jest.clearAllMocks();
  clearGoogleCallback();
  Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
  Constants.executionEnvironment = 'standalone' as typeof Constants.executionEnvironment;
  jest
    .mocked(coreApi.googleStart)
    .mockResolvedValue({ flow_id: flowId, authorize_url: authorize, expires_in: 600 });
  jest.mocked(coreApi.googleFinish).mockResolvedValue(session);
});
afterAll(() => {
  Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
});

test('native PKCE exchange uses exact app callback and shares single-use exchange', async () => {
  jest
    .mocked(WebBrowser.openAuthSessionAsync)
    .mockResolvedValue({ type: 'success', url: `${GOOGLE_IOS_CALLBACK}?code=synthetic-code` });
  await expect(beginGoogleSignIn()).resolves.toBe(session);
  await expect(finishGoogleSignIn()).resolves.toBe(session);
  expect(coreApi.googleStart).toHaveBeenCalledWith('ios');
  expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledWith(authorize, GOOGLE_IOS_CALLBACK);
  expect(coreApi.googleFinish).toHaveBeenCalledTimes(1);
  expect(coreApi.googleFinish).toHaveBeenCalledWith(flowId, 'synthetic-code');
});

test.each(['cancel', 'dismiss'] as const)(
  'native %s does not exchange an auth code',
  async (type) => {
    jest
      .mocked(WebBrowser.openAuthSessionAsync)
      .mockResolvedValue({ type } as Awaited<ReturnType<typeof WebBrowser.openAuthSessionAsync>>);
    await expect(beginGoogleSignIn()).rejects.toThrow('google_login_cancelled');
    expect(coreApi.googleFinish).not.toHaveBeenCalled();
  },
);

test.each([
  'nccugrouping://evil/callback?code=x',
  'https://evil.invalid/auth/callback?code=x',
  `${GOOGLE_IOS_CALLBACK}?code=x&code=y`,
  `${GOOGLE_IOS_CALLBACK}#access_token=private`,
])('reject unexpected callback %s before token exchange', async (url) => {
  jest.mocked(WebBrowser.openAuthSessionAsync).mockResolvedValue({ type: 'success', url });
  await expect(beginGoogleSignIn()).rejects.toThrow();
  expect(coreApi.googleFinish).not.toHaveBeenCalled();
});

test('Expo Go stops before starting an unusable OAuth flow', async () => {
  Constants.executionEnvironment = 'storeClient' as typeof Constants.executionEnvironment;
  await expect(beginGoogleSignIn()).rejects.toThrow('google_native_build_required');
  expect(coreApi.googleStart).not.toHaveBeenCalled();
});

test('no active native flow cannot accept an unsolicited deep link', async () => {
  await expect(finishGoogleSignIn()).rejects.toThrow('google_login_expired_restart');
  expect(coreApi.googleFinish).not.toHaveBeenCalled();
});
