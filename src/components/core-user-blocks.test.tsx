import { afterEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CloudBlockButton } from './core-user-blocks';
import { userBlocksApi } from '@/lib/user-blocks-api';
import { queryClient } from '@/lib/query-client';

jest.mock('@/lib/user-blocks-api', () => ({
  userBlocksApi: { block: jest.fn(), unblock: jest.fn() },
  useBlockedUsers: () => ({ data: { items: [] } }),
}));
jest.mock('@/store/auth-store', () => ({
  useAuthStore: Object.assign(
    (select: (s: unknown) => unknown) => select({ user: { id: 'owner' } }),
    { getState: () => ({ user: { id: 'owner' } }) },
  ),
}));
jest.mock('@/lib/core-api', () => ({ coreError: () => '操作失敗' }));
jest.mock('@/lib/query-client', () => ({
  queryClient: { resetQueries: jest.fn(async () => undefined) },
}));
jest.mock('@/lib/font-size-storage', () => ({
  fontSizeStorage: { getItem: () => null, setItem: jest.fn(), removeItem: jest.fn() },
}));
const client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: 0 } } });
afterEach(async () => {
  await act(async () => {
    client.clear();
  });
  jest.clearAllMocks();
});
it('requires a second explicit press and targets the immutable user ID', async () => {
  jest.mocked(userBlocksApi.block).mockResolvedValue({ user_id: 'target', blocked: true });
  const screen = await render(
    <QueryClientProvider client={client}>
      <CloudBlockButton id="target" name="合成目標" />
    </QueryClientProvider>,
  );
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '封鎖使用者' }));
  });
  expect(userBlocksApi.block).not.toHaveBeenCalled();
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '確認封鎖使用者' }));
  });
  await waitFor(() => expect(userBlocksApi.block).toHaveBeenCalledWith('target'));
  expect(queryClient.resetQueries).toHaveBeenCalledWith({ queryKey: ['core', 'owner'] });
});
it('does not offer self-blocking', async () => {
  const screen = await render(
    <QueryClientProvider client={client}>
      <CloudBlockButton id="owner" />
    </QueryClientProvider>,
  );
  expect(screen.queryByRole('button')).toBeNull();
});
