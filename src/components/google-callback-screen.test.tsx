import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render } from '@testing-library/react-native';
import { StrictMode } from 'react';
import { router } from 'expo-router';
import GoogleCallbackScreen from '@/app/auth/callback';
import { finishGoogleSignIn } from '@/lib/google-login';
import type { CoreSession } from '@/lib/core-api';

const mockAccept = jest.fn<(session: CoreSession) => Promise<boolean>>();
jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
  useLocalSearchParams: () => ({ code: 'synthetic-code' }),
}));
jest.mock('@/lib/google-login', () => ({
  finishGoogleSignIn: jest.fn(),
  clearGoogleCallback: jest.fn(),
}));
jest.mock('@/lib/core-api', () => ({
  CORE_API_ENABLED: true,
  CORE_SUPABASE_MODE: true,
  coreError: () => 'Google 登入已失效，請重新開始。',
}));
jest.mock('@/store/auth-store', () => ({
  useAuthStore: { getState: () => ({ user: null, acceptGoogleSession: mockAccept }) },
}));
jest.mock('@/lib/font-size-storage', () => ({
  fontSizeStorage: { getItem: () => null, setItem: jest.fn(), removeItem: jest.fn() },
}));
const session = {
  access_token: 'synthetic-token',
  user: { id: 'synthetic-user', auth_mode: 'supabase', profile_setup_required: false },
} as CoreSession;
let resolveExchange: (session: CoreSession) => void;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockAccept.mockResolvedValue(true);
  jest.mocked(finishGoogleSignIn).mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveExchange = resolve;
      }),
  );
});
afterEach(() => {
  jest.useRealTimers();
});

it('keeps the callback mounted while exchanging instead of replacing its own route', async () => {
  await render(<GoogleCallbackScreen />);
  expect(finishGoogleSignIn).toHaveBeenCalledTimes(1);
  expect(router.replace).not.toHaveBeenCalled();
  await act(async () => {
    resolveExchange(session);
  });
  expect(mockAccept).toHaveBeenCalledTimes(1);
  expect(router.replace).toHaveBeenCalledWith('/');
});

it('routes a first Google login directly to profile setup after storing the session', async () => {
  await render(<GoogleCallbackScreen />);
  await act(async () => {
    resolveExchange({ ...session, user: { ...session.user, profile_setup_required: true } });
  });
  expect(mockAccept).toHaveBeenCalledTimes(1);
  expect(router.replace).toHaveBeenCalledWith('/edit-profile');
});

it('ends a stuck exchange with a retry path and ignores a late successful response', async () => {
  const screen = await render(<GoogleCallbackScreen />);
  await act(async () => {
    jest.advanceTimersByTime(30_000);
  });
  expect(screen.getByText(/登入確認逾時/)).toBeTruthy();
  expect(screen.queryByLabelText('正在確認 Google 登入')).toBeNull();
  await act(async () => {
    resolveExchange(session);
  });
  expect(mockAccept).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: '返回登入頁' }));
  expect(router.replace).toHaveBeenCalledWith('/sign-in');
});

it('shows a recoverable error when a proof is missing or expired', async () => {
  jest.mocked(finishGoogleSignIn).mockRejectedValue(new Error('google_login_expired_restart'));
  const screen = await render(<GoogleCallbackScreen />);
  expect(screen.getByText(/Google 登入已失效/)).toBeTruthy();
  expect(mockAccept).not.toHaveBeenCalled();
});

it('ignores a response received after leaving the callback', async () => {
  const screen = await render(<GoogleCallbackScreen />);
  await screen.unmount();
  await act(async () => {
    resolveExchange(session);
  });
  expect(mockAccept).not.toHaveBeenCalled();
  expect(router.replace).not.toHaveBeenCalled();
});

it('accepts a shared single-use exchange only once across effect replays', async () => {
  const shared = new Promise<CoreSession>((resolve) => {
    resolveExchange = resolve;
  });
  jest.mocked(finishGoogleSignIn).mockReturnValue(shared);
  await render(
    <StrictMode>
      <GoogleCallbackScreen />
    </StrictMode>,
  );
  await act(async () => {
    resolveExchange(session);
  });
  expect(mockAccept).toHaveBeenCalledTimes(1);
  expect(router.replace).toHaveBeenCalledTimes(1);
  expect(router.replace).toHaveBeenCalledWith('/');
});
