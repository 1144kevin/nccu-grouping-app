import { afterEach, expect, it, jest } from '@jest/globals';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from 'expo-router';
import { UnifiedInbox } from './unified-inbox';
import { socialApi } from '@/lib/social-api';

jest.mock('@/components/stealth-conversations', () => ({ StealthConversations: () => null }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: jest.fn(),
  Link: ({ children }: { children: unknown }) => children,
}));
jest.mock('@/components/chat-swipe-row', () => ({
  ChatSwipeRow: ({ children }: { children: unknown }) => children,
}));
jest.mock('@/lib/core-hooks', () => ({ invalidateCore: jest.fn(async () => undefined) }));
jest.mock('@/lib/core-api', () => ({ coreError: () => '失敗' }));
jest.mock('@/store/auth-store', () => ({
  useAuthStore: Object.assign(
    (select: (s: { user: { id: string } }) => unknown) => select({ user: { id: 'self' } }),
    { getState: () => ({ user: { id: 'self' } }) },
  ),
}));
jest.mock('@/lib/font-size-storage', () => ({
  fontSizeStorage: { getItem: () => null, setItem: jest.fn(), removeItem: jest.fn() },
}));
jest.mock('@/lib/social-api', () => ({
  socialApi: { preference: jest.fn(async () => ({})) },
  useInboxThreads: (kind: string, deleted: boolean) => ({
    items:
      deleted || kind === 'group'
        ? []
        : [
            {
              id: 'dm',
              kind: 'direct',
              post: { id: 'post', content: '活動剩餘便當', author_name: '主揪', joined: 2 },
              peer_name: '主揪名字',
              peer_badge: '🍱',
              updated_at: new Date().toISOString(),
              unread_count: 1,
              pinned: false,
              inbox: 'general',
            },
          ],
    isPending: false,
    isFetching: false,
  }),
}));
const client = new QueryClient({ defaultOptions: { mutations: { gcTime: 0, retry: false } } });
afterEach(() => {
  client.clear();
  jest.clearAllMocks();
});
const ui = () => (
  <QueryClientProvider client={client}>
    <UnifiedInbox />
  </QueryClientProvider>
);
it('uses post titles for DMs and separates group and private tabs', async () => {
  const screen = await render(ui());
  expect(screen.getByText('【私訊】活動剩餘便當')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: '開啟 【私訊】活動剩餘便當' }));
  expect(router.push).toHaveBeenCalledWith('/direct-chat/dm');
  await fireEvent.press(screen.getByRole('tab', { name: '群組' }));
  expect(screen.queryByText('【私訊】活動剩餘便當')).toBeNull();
  await fireEvent.press(screen.getByRole('tab', { name: '私訊' }));
  expect(screen.getByText('【私訊】活動剩餘便當')).toBeTruthy();
});
it('deletes only the selected conversation preference and offers undo', async () => {
  const screen = await render(ui());
  await fireEvent.press(screen.getByRole('button', { name: '聊天室選項' }));
  await fireEvent.press(screen.getByRole('button', { name: '刪除聊天室' }));
  await waitFor(() =>
    expect(socialApi.preference).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'dm', kind: 'direct' }),
      { deleted: true },
    ),
  );
  await fireEvent.press(screen.getByRole('button', { name: '復原' }));
  await waitFor(() =>
    expect(socialApi.preference).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'dm' }), {
      deleted: false,
    }),
  );
});
