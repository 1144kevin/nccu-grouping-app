import { afterEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render } from '@testing-library/react-native';
import { CoreLoginScreen } from './core-auth-gate';
import * as runtime from '@/lib/app-runtime';

const mockAuthenticate = jest.fn<() => Promise<boolean>>().mockResolvedValue(true);
jest.mock('@/lib/app-runtime', () => ({ __esModule: true, isExpoGo: jest.fn(() => true) }));
jest.mock('@/lib/core-api', () => ({
  CORE_API_ENABLED: true,
  CORE_SUPABASE_MODE: true,
  coreError: () => '測試錯誤',
}));
jest.mock('@/store/auth-store', () => ({
  useAuthStore: (selector?: (s: unknown) => unknown) => {
    const state = {
      ready: true,
      busy: false,
      error: null,
      authenticate: mockAuthenticate,
      restore: jest.fn(),
    };
    return selector ? selector(state) : state;
  },
}));
jest.mock('@/components/core-connection-status', () => ({ CoreConnectionStatus: () => null }));
jest.mock('@/lib/font-size-storage', () => ({
  fontSizeStorage: {
    getItem: () => null,
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));
afterEach(() => {
  jest.clearAllMocks();
  jest.mocked(runtime.isExpoGo).mockReturnValue(true);
});
it('Expo Go hides unsupported Google login and keeps real email/password authentication', async () => {
  const screen = await render(<CoreLoginScreen />);
  expect(screen.queryByRole('button', { name: '使用 Google 帳號登入' })).toBeNull();
  expect(screen.getByText(/請使用信箱與 App 密碼登入/)).toBeTruthy();
  await act(async () => {
    await fireEvent.changeText(screen.getByLabelText('信箱'), 'fixture@example.test');
    await fireEvent.changeText(screen.getByLabelText('密碼'), 'dedicated-fixture-password');
  });
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '登入' }));
  });
  expect(mockAuthenticate).toHaveBeenCalledWith(
    'login',
    'fixture@example.test',
    'dedicated-fixture-password',
    '',
  );
});
it('native builds retain Google login', async () => {
  jest.mocked(runtime.isExpoGo).mockReturnValue(false);
  const screen = await render(<CoreLoginScreen />);
  expect(screen.getByText('政缺一咖 · 和附近的人一起分享')).toBeTruthy();
  expect(screen.getByRole('button', { name: '使用 Google 帳號登入' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: '還沒有帳號？立即註冊' }));
  expect(screen.getByText('政缺一咖，正缺你這咖')).toBeTruthy();
  expect(screen.getByRole('button', { name: '使用Google帳號註冊' })).toBeTruthy();
});

it('requires consent before email registration and makes both documents readable first', async () => {
  const screen = await render(<CoreLoginScreen />);
  await fireEvent.press(screen.getByRole('button', { name: '還沒有帳號？立即註冊' }));
  await fireEvent.press(screen.getByRole('link', { name: '閱讀用戶使用協議' }));
  expect(screen.getByText('一、服務與適用範圍')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: '關閉條款' }));
  await fireEvent.press(screen.getByRole('link', { name: '閱讀隱私權保護政策' }));
  expect(screen.getByText('二、蒐集的資料')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: '關閉條款' }));
  await fireEvent.changeText(screen.getByLabelText('顯示名稱'), '測試使用者');
  await fireEvent.changeText(screen.getByLabelText('信箱'), 'fixture@example.test');
  await fireEvent.changeText(screen.getByLabelText('密碼'), 'dedicated-fixture-password');
  expect(screen.getByRole('button', { name: '建立帳號' }).props.accessibilityState?.disabled).toBe(
    true,
  );
  await fireEvent.press(screen.getByRole('checkbox', { name: '同意用戶使用協議與隱私權保護政策' }));
  await fireEvent.press(screen.getByRole('button', { name: '建立帳號' }));
  expect(mockAuthenticate).toHaveBeenCalledWith(
    'register',
    'fixture@example.test',
    'dedicated-fixture-password',
    '測試使用者',
  );
});
it('requires consent before starting Google sign in', async () => {
  jest.mocked(runtime.isExpoGo).mockReturnValue(false);
  const screen = await render(<CoreLoginScreen />);
  const button = () => screen.getByRole('button', { name: '使用 Google 帳號登入' });
  expect(button().props.accessibilityState?.disabled).toBe(true);
  await fireEvent.press(screen.getByRole('checkbox', { name: '同意用戶使用協議與隱私權保護政策' }));
  expect(button().props.accessibilityState?.disabled).toBe(false);
});
