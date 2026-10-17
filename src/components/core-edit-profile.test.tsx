import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from 'expo-router';
import { CoreEditProfileScreen } from './core-edit-profile';
import { coreApi, type CoreUser } from '@/lib/core-api';
import { invalidateCore } from '@/lib/core-hooks';
import { useAuthStore } from '@/store/auth-store';

jest.mock('expo-router', () => ({ router: { canGoBack: jest.fn(() => false), back: jest.fn(), replace: jest.fn() } }));
jest.mock('@/lib/api', () => ({ authToken: {} }));
jest.mock('@/lib/core-api', () => ({ coreApi: { updateProfile: jest.fn(), me: jest.fn() }, coreError: () => '操作失敗' }));
jest.mock('@/lib/core-hooks', () => ({ invalidateCore: jest.fn(async () => undefined) }));
jest.mock('@/lib/font-size-storage', () => ({ fontSizeStorage: { getItem: jest.fn(() => null), setItem: jest.fn(), removeItem: jest.fn() } }));

const user: CoreUser = { id: 'user-a', email: 'a@example.test', display_name: '測試甲', created_at: '2026-10-16T10:00:00Z', auth_mode: 'supabase', email_verified: true, version: 1 };
const client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: 0 } } });
beforeEach(() => {
  useAuthStore.setState({ user, ready: true, busy: false, error: null });
  jest.mocked(coreApi.updateProfile).mockResolvedValue({ ...user, version: 2 });
  jest.mocked(invalidateCore).mockResolvedValue(undefined);
});
afterEach(async () => {
  await act(async () => { client.clear(); useAuthStore.setState({ user: null }); });
  jest.clearAllMocks();
});

it('opens the profile after saving a directly opened edit page', async () => {
  const screen = await render(<QueryClientProvider client={client}><CoreEditProfileScreen /></QueryClientProvider>);
  await act(async () => { await fireEvent.press(screen.getByRole('button', { name: '儲存變更' })); });
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/profile'));
  expect(router.back).not.toHaveBeenCalled();
});

it('does not navigate a different account when an old save finishes refreshing', async () => {
  let finishRefresh: () => void = () => undefined;
  jest.mocked(invalidateCore).mockImplementation(() => new Promise<void>((resolve) => { finishRefresh = resolve; }));
  const screen = await render(<QueryClientProvider client={client}><CoreEditProfileScreen /></QueryClientProvider>);
  await act(async () => { await fireEvent.press(screen.getByRole('button', { name: '儲存變更' })); });
  await waitFor(() => expect(useAuthStore.getState().user?.version).toBe(2));
  await act(async () => { useAuthStore.setState({ user: { ...user, id: 'user-b' } }); finishRefresh(); });
  await waitFor(() => expect(screen.getByRole('button', { name: '儲存變更' })).toBeTruthy());
  expect(router.back).not.toHaveBeenCalled();
  expect(router.replace).not.toHaveBeenCalled();
});
