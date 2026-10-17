import { beforeEach, expect, it, jest } from '@jest/globals';
import { AxiosError, type AxiosResponse } from 'axios';
import { authToken } from '@/lib/api';
import { coreApi, type CoreSession } from '@/lib/core-api';
import { applyProfileUpdate, useAuthStore } from '@/store/auth-store';

jest.mock('@/lib/api', () => ({ authToken: { get: jest.fn(), set: jest.fn(), setSession: jest.fn(), clear: jest.fn() } }));
jest.mock('@/lib/core-api', () => ({ coreApi: { me: jest.fn(), login: jest.fn(), register: jest.fn(), logout: jest.fn() }, coreError: () => 'test-error' }));
jest.mock('@/lib/query-client', () => ({ queryClient: { clear: jest.fn() } }));

const session: CoreSession = { access_token: 'synthetic-access-token', expires_at: '2026-10-17T10:00:00Z', user: { id: 'user-a', email: 'a@example.test', display_name: '測試甲', created_at: '2026-10-16T10:00:00Z', auth_mode: 'local_development', email_verified: false } };

beforeEach(() => {
  jest.resetAllMocks();
  useAuthStore.setState({ user: null, ready: false, busy: false, error: null });
  jest.mocked(authToken.set).mockResolvedValue(undefined);
  jest.mocked(authToken.clear).mockResolvedValue(undefined);
});

it('only enters the app after the login token has been stored', async () => {
  jest.mocked(coreApi.login).mockResolvedValue(session);
  expect(await useAuthStore.getState().authenticate('login', ' a@example.test ', 'Synthetic-password', '')).toBe(true);
  expect(coreApi.login).toHaveBeenCalledWith('a@example.test', 'Synthetic-password');
  expect(authToken.set).toHaveBeenCalledWith(session.access_token);
  expect(useAuthStore.getState().user?.id).toBe('user-a');
});

it('stores the refresh credential returned by cloud login', async () => {
  const cloud = { ...session, refresh_token: 'synthetic-refresh', user: { ...session.user, auth_mode: 'supabase' as const } };
  jest.mocked(coreApi.login).mockResolvedValue(cloud);
  jest.mocked(authToken.setSession).mockResolvedValue(undefined);
  expect(await useAuthStore.getState().authenticate('login', 'a@example.test', 'Synthetic-password', '')).toBe(true);
  expect(authToken.setSession).toHaveBeenCalledWith(cloud);
  expect(authToken.set).not.toHaveBeenCalled();
});

it('does not pretend logout succeeded when the backend is unavailable', async () => {
  useAuthStore.setState({ user: session.user, ready: true });
  jest.mocked(coreApi.logout).mockRejectedValue(new AxiosError('offline'));
  expect(await useAuthStore.getState().logout()).toBe(false);
  expect(useAuthStore.getState().user?.id).toBe('user-a');
  expect(authToken.clear).not.toHaveBeenCalled();
});

it('clears an expired session but preserves a token on temporary network failures', async () => {
  jest.mocked(authToken.get).mockResolvedValue('synthetic-token');
  jest.mocked(coreApi.me).mockRejectedValue(new AxiosError('expired', undefined, undefined, undefined, { status: 401 } as AxiosResponse));
  await useAuthStore.getState().restore();
  expect(authToken.clear).toHaveBeenCalledTimes(1);
  jest.mocked(coreApi.me).mockRejectedValue(new AxiosError('offline'));
  await useAuthStore.getState().restore();
  expect(authToken.clear).toHaveBeenCalledTimes(1);
  expect(useAuthStore.getState().user).toBeNull();
});

it('does not authenticate twice while a login is pending', async () => {
  let resolveLogin: (value: CoreSession) => void = () => undefined;
  jest.mocked(coreApi.login).mockImplementation(() => new Promise((resolve) => { resolveLogin = resolve; }));
  const first = useAuthStore.getState().authenticate('login', 'a@example.test', 'Synthetic-password', '');
  expect(await useAuthStore.getState().authenticate('login', 'a@example.test', 'Synthetic-password', '')).toBe(false);
  resolveLogin(session);
  await first;
  expect(coreApi.login).toHaveBeenCalledTimes(1);
});

it('does not resurrect a logged out account or overwrite a newer profile with an old response', () => {
  expect(applyProfileUpdate(session.user)).toBe(false);
  useAuthStore.setState({ user: { ...session.user, version: 2 } });
  expect(applyProfileUpdate({ ...session.user, id: 'another-account', version: 3 })).toBe(false);
  expect(applyProfileUpdate({ ...session.user, version: 1 })).toBe(false);
  expect(applyProfileUpdate({ ...session.user, display_name: '新的名稱', version: 3 })).toBe(true);
  expect(useAuthStore.getState().user?.display_name).toBe('新的名稱');
});

it('keeps signup awaiting email verification outside authenticated screens', async () => {
  jest.mocked(coreApi.register).mockResolvedValue({ confirmation_required: true, message: 'check_email_to_confirm' });
  expect(await useAuthStore.getState().authenticate('register', 'a@example.test', 'Synthetic-password', '測試')).toBe(false);
  expect(authToken.set).not.toHaveBeenCalled();
  expect(useAuthStore.getState().user).toBeNull();
  expect(useAuthStore.getState().error).toContain('信箱驗證');
});

it('stores a verified cloud Google session without overwriting an already signed-in account', async () => {
  const google = { ...session, user: { ...session.user, auth_mode: 'supabase' as const, email_verified: true } };
  expect(await useAuthStore.getState().acceptGoogleSession(google)).toBe(true);
  expect(authToken.set).toHaveBeenCalledWith(google.access_token);
  expect(await useAuthStore.getState().acceptGoogleSession({ ...google, user: { ...google.user, id: 'another-user' } })).toBe(false);
  expect(useAuthStore.getState().user?.id).toBe(google.user.id);
});
