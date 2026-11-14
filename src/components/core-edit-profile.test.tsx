import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from 'expo-router';
import { CoreEditProfileScreen } from './core-edit-profile';
import { coreApi, type CoreUser } from '@/lib/core-api';
import { invalidateCore } from '@/lib/core-hooks';
import { useAuthStore } from '@/store/auth-store';

jest.mock('expo-router', () => ({
  router: { canGoBack: jest.fn(() => false), back: jest.fn(), replace: jest.fn() },
}));
jest.mock('@/lib/api', () => ({ authToken: {} }));
jest.mock('@/lib/core-api', () => ({
  coreApi: { updateProfile: jest.fn(), me: jest.fn() },
  newRequestKey: () => 'synthetic-avatar-key',
  coreError: () => '操作失敗',
}));
jest.mock('@/lib/core-hooks', () => ({ invalidateCore: jest.fn(async () => undefined) }));
jest.mock('@/lib/font-size-storage', () => ({
  fontSizeStorage: { getItem: jest.fn(() => null), setItem: jest.fn(), removeItem: jest.fn() },
}));

const user: CoreUser = {
  id: 'user-a',
  email: 'a@example.test',
  display_name: '測試甲',
  created_at: '2026-10-16T10:00:00Z',
  auth_mode: 'supabase',
  email_verified: true,
  version: 1,
};
const client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: 0 } } });
beforeEach(() => {
  useAuthStore.setState({ user, ready: true, busy: false, error: null });
  jest.mocked(coreApi.updateProfile).mockResolvedValue({ ...user, version: 2 });
  jest.mocked(invalidateCore).mockResolvedValue(undefined);
});
afterEach(async () => {
  await act(async () => {
    client.clear();
    useAuthStore.setState({ user: null });
  });
  jest.clearAllMocks();
});

it('opens the profile after saving a directly opened edit page', async () => {
  const screen = await render(
    <QueryClientProvider client={client}>
      <CoreEditProfileScreen />
    </QueryClientProvider>,
  );
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '儲存變更' }));
  });
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/profile'));
  expect(router.back).not.toHaveBeenCalled();
});

it('offers three avatar rows and saves a selected preset in place of a profile photo', async () => {
  useAuthStore.setState({ user: { ...user, avatar_id: 'old-avatar', badge: '🍱' } });
  const screen = await render(
    <QueryClientProvider client={client}>
      <CoreEditProfileScreen />
    </QueryClientProvider>,
  );
  expect(screen.getByText('頭像')).toBeTruthy();
  expect(screen.getByText('水果人')).toBeTruthy();
  expect(screen.getByText('橘子寶寶')).toBeTruthy();
  expect(screen.getAllByRole('radio')).toHaveLength(28);
  await fireEvent.press(screen.getByLabelText('頭像 手搖杯'));
  await fireEvent.press(screen.getByRole('button', { name: '儲存變更' }));
  await waitFor(() => expect(coreApi.updateProfile).toHaveBeenCalledWith(
    expect.objectContaining({ badge: 'eagle-01', avatar_id: null }),
  ));
});

it('saves a fruit avatar in place of an uploaded profile photo', async () => {
  useAuthStore.setState({ user: { ...user, avatar_id: 'old-avatar', badge: 'eagle-01' } });
  const screen = await render(
    <QueryClientProvider client={client}>
      <CoreEditProfileScreen />
    </QueryClientProvider>,
  );
  await fireEvent.press(screen.getByLabelText('頭像 橘子老闆'));
  expect(screen.getByLabelText('頭像 橘子老闆').props.accessibilityState.checked).toBe(true);
  await fireEvent.press(screen.getByRole('button', { name: '儲存變更' }));
  await waitFor(() => expect(coreApi.updateProfile).toHaveBeenCalledWith(
    expect.objectContaining({ badge: 'fruit-orange', avatar_id: null }),
  ));
});

it('saves an orange baby avatar in place of a fruit avatar', async () => {
  useAuthStore.setState({ user: { ...user, badge: 'fruit-orange' } });
  const screen = await render(
    <QueryClientProvider client={client}>
      <CoreEditProfileScreen />
    </QueryClientProvider>,
  );
  await fireEvent.press(screen.getByLabelText('頭像 橘子學生'));
  expect(screen.getByLabelText('頭像 橘子學生').props.accessibilityState.checked).toBe(true);
  expect(screen.getByLabelText('頭像 橘子老闆').props.accessibilityState.checked).toBe(false);
  await fireEvent.press(screen.getByRole('button', { name: '儲存變更' }));
  await waitFor(() => expect(coreApi.updateProfile).toHaveBeenCalledWith(
    expect.objectContaining({ badge: 'orange-student', avatar_id: null }),
  ));
});

it('requires a successful save before completing new-user setup', async () => {
  useAuthStore.setState({ user: { ...user, profile_setup_required: true } });
  jest.mocked(coreApi.updateProfile).mockRejectedValueOnce(new Error('offline'));
  const screen = await render(
    <QueryClientProvider client={client}>
      <CoreEditProfileScreen onboarding />
    </QueryClientProvider>,
  );
  expect(screen.queryByRole('button', { name: '返回' })).toBeNull();
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '儲存並進入 App' }));
  });
  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  expect(useAuthStore.getState().user?.profile_setup_required).toBe(true);
  jest
    .mocked(coreApi.updateProfile)
    .mockResolvedValueOnce({ ...user, version: 2, profile_setup_required: false });
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '儲存並進入 App' }));
  });
  await waitFor(() => expect(useAuthStore.getState().user?.profile_setup_required).toBe(false));
  expect(router.replace).toHaveBeenCalledWith('/');
});

it('does not navigate a different account when an old save finishes refreshing', async () => {
  let finishRefresh: () => void = () => undefined;
  jest.mocked(invalidateCore).mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finishRefresh = resolve;
      }),
  );
  const screen = await render(
    <QueryClientProvider client={client}>
      <CoreEditProfileScreen />
    </QueryClientProvider>,
  );
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '儲存變更' }));
  });
  await waitFor(() => expect(useAuthStore.getState().user?.version).toBe(2));
  await act(async () => {
    useAuthStore.setState({ user: { ...user, id: 'user-b' } });
    finishRefresh();
  });
  await waitFor(() => expect(screen.getByRole('button', { name: '儲存變更' })).toBeTruthy());
  expect(router.back).not.toHaveBeenCalled();
  expect(router.replace).not.toHaveBeenCalled();
});
