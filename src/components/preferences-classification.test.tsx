import { expect, it, jest } from '@jest/globals';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PreferencesForm } from './core-account-preferences';
import { engagementApi } from '@/lib/engagement-api';

jest.mock('@/store/auth-store', () => ({
  useAuthStore: Object.assign(
    (select: (value: unknown) => unknown) => select({ user: { id: 'self' } }),
    { getState: () => ({ user: { id: 'self' } }) },
  ),
}));
jest.mock('@/lib/engagement-api', () => ({
  engagementApi: { savePreferences: jest.fn(async (value: object) => ({ ...value, version: 1 })) },
}));
jest.mock('@/lib/font-size-storage', () => ({
  fontSizeStorage: { getItem: () => null, setItem: jest.fn(), removeItem: jest.fn() },
}));
jest.mock('@/components/web-push-settings', () => ({ WebPushSettings: () => null }));

it('saves a custom location separately while keeping it in recommendation tags', async () => {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const initial = {
    version: 0,
    preferred_tags: [],
    custom_locations: [],
    notifications: {
      joinRequests: true,
      messages: true,
      recommendations: true,
      deadlineReminders: true,
      stealthInvites: true,
    },
  };
  const screen = await render(
    <QueryClientProvider client={client}>
      <PreferencesForm initial={initial} mode="recommendations" />
    </QueryClientProvider>,
  );
  await fireEvent.press(screen.getByRole('radio', { name: '新增地點' }));
  await fireEvent.changeText(screen.getByLabelText('自訂推薦標籤'), '自強十舍');
  await fireEvent.press(screen.getByRole('button', { name: '加入自訂標籤' }));
  expect(screen.getByRole('checkbox', { name: '自強十舍' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: '儲存' }));
  await waitFor(() =>
    expect(engagementApi.savePreferences).toHaveBeenCalledWith(
      expect.objectContaining({ preferred_tags: ['自強十舍'], custom_locations: ['自強十舍'] }),
      0,
    ),
  );
  await cleanup();
  client.clear();
});
