import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AccountDeletionPanel, AccountDeletionRecovery } from './core-account-deletion';
import { accountDeletionApi } from '@/lib/account-deletion-api';
import { completeAccountDeletion } from '@/store/auth-store';

jest.mock('@/lib/account-deletion-api', () => ({
  accountDeletionApi: { status: jest.fn(), preview: jest.fn(), delete: jest.fn() },
}));
jest.mock('@/store/auth-store', () => ({
  completeAccountDeletion: jest.fn(),
  useAuthStore: Object.assign(
    (select: (s: unknown) => unknown) => select({ user: { id: 'owner' } }),
    { getState: () => ({ user: { id: 'owner' } }), setState: jest.fn() },
  ),
}));
jest.mock('@/lib/core-hooks', () => ({ useCoreScreenFocused: jest.fn(() => true) }));
jest.mock('@/lib/core-api', () => ({
  coreApi: { me: jest.fn() },
  coreError: () => '清理未完成，請重試',
}));
jest.mock('@/lib/font-size-storage', () => ({
  fontSizeStorage: { getItem: () => null, setItem: jest.fn(), removeItem: jest.fn() },
}));
const counts = { owned_posts: 1, messages: 2, images: 1, participations: 1, proposals: 1 };
const client = new QueryClient({
  defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } },
});
beforeEach(() => {
  jest
    .mocked(accountDeletionApi.status)
    .mockResolvedValue({ phase: 'none', recent_auth: true, counts });
  jest
    .mocked(accountDeletionApi.preview)
    .mockResolvedValue({ phase: 'prepared', challenge: 'x'.repeat(43), expires_in: 600, counts });
});
afterEach(async () => {
  await act(async () => {
    await cleanup();
    client.clear();
    await new Promise((r) => setTimeout(r, 0));
  });
  jest.clearAllMocks();
});

it('requires preview and exact typed confirmation before deleting', async () => {
  jest.mocked(accountDeletionApi.delete).mockResolvedValue({ deleted: true });
  const screen = await render(
    <QueryClientProvider client={client}>
      <AccountDeletionPanel />
    </QueryClientProvider>,
  );
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: '刪除我的帳號' }).props.accessibilityState?.disabled,
    ).toBe(false),
  );
  expect(accountDeletionApi.delete).not.toHaveBeenCalled();
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '刪除我的帳號' }));
  });
  await waitFor(() => expect(screen.getByLabelText('輸入 DELETE 確認刪除帳號')).toBeTruthy());
  await act(async () => {
    await fireEvent.changeText(screen.getByLabelText('輸入 DELETE 確認刪除帳號'), 'delete');
  });
  expect(
    screen.getByRole('button', { name: '永久刪除我的 App 帳號' }).props.accessibilityState
      ?.disabled,
  ).toBe(true);
  await act(async () => {
    await fireEvent.changeText(screen.getByLabelText('輸入 DELETE 確認刪除帳號'), 'DELETE');
  });
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '永久刪除我的 App 帳號' }));
  });
  await waitFor(() => expect(accountDeletionApi.delete).toHaveBeenCalledWith('x'.repeat(43)));
  await waitFor(() => expect(completeAccountDeletion).toHaveBeenCalledWith('owner'));
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: '永久刪除我的 App 帳號' }).props.accessibilityState
        ?.disabled,
    ).toBe(false),
  );
});

it('resumes confirmed cleanup without requiring a lost preview challenge', async () => {
  jest
    .mocked(accountDeletionApi.status)
    .mockResolvedValue({ phase: 'deleting', recent_auth: true, counts });
  jest.mocked(accountDeletionApi.delete).mockResolvedValue({ deleted: true });
  const screen = await render(
    <QueryClientProvider client={client}>
      <AccountDeletionRecovery />
    </QueryClientProvider>,
  );
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: '刪除我的帳號' }).props.accessibilityState?.disabled,
    ).toBe(false),
  );
  await fireEvent.press(screen.getByRole('button', { name: '刪除我的帳號' }));
  await waitFor(() => expect(screen.getByLabelText('輸入 DELETE 確認刪除帳號')).toBeTruthy());
  await act(async () => {
    await fireEvent.changeText(screen.getByLabelText('輸入 DELETE 確認刪除帳號'), 'DELETE');
  });
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '繼續刪除我的帳號' }));
  });
  await waitFor(() => expect(accountDeletionApi.delete).toHaveBeenCalledWith(undefined));
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: '繼續刪除我的帳號' }).props.accessibilityState?.disabled,
    ).toBe(false),
  );
  expect(accountDeletionApi.preview).not.toHaveBeenCalled();
});

it('allows a valid older session to prepare deletion', async () => {
  jest
    .mocked(accountDeletionApi.status)
    .mockResolvedValue({ phase: 'none', recent_auth: false, counts });
  const screen = await render(
    <QueryClientProvider client={client}>
      <AccountDeletionPanel />
    </QueryClientProvider>,
  );
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: '刪除我的帳號' }).props.accessibilityState?.disabled,
    ).toBe(false),
  );
  await fireEvent.press(screen.getByRole('button', { name: '刪除我的帳號' }));
  await waitFor(() => expect(screen.getByLabelText('輸入 DELETE 確認刪除帳號')).toBeTruthy());
  expect(accountDeletionApi.preview).toHaveBeenCalled();
  expect(accountDeletionApi.delete).not.toHaveBeenCalled();
});
