import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { CoreAppPasswordScreen } from './core-app-password';
import { coreApi, type CoreUser } from '@/lib/core-api';
import { useAuthStore } from '@/store/auth-store';

jest.mock('expo-router', () => ({ router: { back: jest.fn(), canGoBack: () => false, replace: jest.fn() } }));
jest.mock('@/lib/api', () => ({ authToken: {} }));
jest.mock('@/lib/core-api', () => ({ coreApi: { setAppPassword: jest.fn() }, coreError: () => '請重新用 Google 登入。' }));
jest.mock('@/lib/font-size-storage', () => ({ fontSizeStorage: { getItem: jest.fn(() => null), setItem: jest.fn(), removeItem: jest.fn() } }));
const user: CoreUser = { id: 'user-a', email: 'a@example.test', display_name: '測試甲', created_at: '2026-10-16T10:00:00Z', auth_mode: 'supabase', email_verified: true };
beforeEach(() => { useAuthStore.setState({ user, ready: true }); jest.mocked(coreApi.setAppPassword).mockResolvedValue(undefined); });
afterEach(() => { jest.clearAllMocks(); useAuthStore.setState({ user: null }); });

it('requires matching passwords, submits only after confirmation, and clears both fields', async () => {
  const screen = await render(<CoreAppPasswordScreen />);
  await fireEvent.changeText(screen.getByLabelText('新 App 密碼'), 'Synthetic-password-123!');
  await fireEvent.changeText(screen.getByLabelText('再次輸入 App 密碼'), 'different-password');
  await fireEvent.press(screen.getByRole('button', { name: '確認設定 App 密碼' }));
  expect(coreApi.setAppPassword).not.toHaveBeenCalled();
  await fireEvent.changeText(screen.getByLabelText('再次輸入 App 密碼'), 'Synthetic-password-123!');
  await fireEvent.press(screen.getByRole('button', { name: '確認設定 App 密碼' }));
  await waitFor(() => expect(screen.getByText(/App 密碼已設定/)).toBeTruthy());
  expect(coreApi.setAppPassword).toHaveBeenCalledWith('Synthetic-password-123!', 'user-a');
  expect(screen.getByLabelText('新 App 密碼').props.value).toBe('');
  expect(screen.getByLabelText('再次輸入 App 密碼').props.value).toBe('');
});

it('does not show previous account completion after an account switch', async () => {
  let finish: () => void = () => undefined;
  jest.mocked(coreApi.setAppPassword).mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
  const screen = await render(<CoreAppPasswordScreen />);
  await fireEvent.changeText(screen.getByLabelText('新 App 密碼'), 'Synthetic-password-123!');
  await fireEvent.changeText(screen.getByLabelText('再次輸入 App 密碼'), 'Synthetic-password-123!');
  await fireEvent.press(screen.getByRole('button', { name: '確認設定 App 密碼' }));
  await act(async () => { useAuthStore.setState({ user: { ...user, id: 'user-b', email: 'b@example.test' } }); finish(); });
  expect(screen.queryByText(/App 密碼已設定/)).toBeNull();
  expect(screen.getByLabelText('新 App 密碼').props.value).toBe('');
});

it('keeps input available for retry when Auth requires another Google login', async () => {
  jest.mocked(coreApi.setAppPassword).mockRejectedValue(new Error('reauthentication_needed'));
  const screen = await render(<CoreAppPasswordScreen />);
  await fireEvent.changeText(screen.getByLabelText('新 App 密碼'), 'Synthetic-password-123!');
  await fireEvent.changeText(screen.getByLabelText('再次輸入 App 密碼'), 'Synthetic-password-123!');
  await fireEvent.press(screen.getByRole('button', { name: '確認設定 App 密碼' }));
  await waitFor(() => expect(screen.getByText('請重新用 Google 登入。')).toBeTruthy());
  expect(screen.getByLabelText('新 App 密碼').props.value).toBe('Synthetic-password-123!');
  expect(screen.queryByText(/App 密碼已設定/)).toBeNull();
});
