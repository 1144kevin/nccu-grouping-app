import { afterEach, expect, it, jest } from '@jest/globals';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from 'expo-router';
import { UnifiedInbox } from './unified-inbox';
import { socialApi } from '@/lib/social-api';

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
              last_message: { sender_name: '小安', content: '請問可以少飯嗎？' },
              updated_at: new Date().toISOString(),
              unread_count: 1,
              pinned: false,
              inbox: 'general',
            },
            {
              id: 'stealth',
              kind: 'stealth',
              post: null,
              title: '一起喝奶茶',
              preview: '已接受 · 等待夥伴回覆',
              peer_name: '偷揪夥伴',
              peer_badge: '🧋',
              updated_at: new Date().toISOString(),
              unread_count: 0,
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
  expect(screen.getByText('小安：請問可以少飯嗎？')).toBeTruthy();
  expect(screen.getByRole('tab', { name: '主要' })).toBeTruthy();
  expect(screen.queryByText('一般 · 主揪名字')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: '開啟 【私訊】活動剩餘便當' }));
  expect(router.push).toHaveBeenCalledWith('/direct-chat/dm');
  await fireEvent.press(screen.getByRole('tab', { name: '群組' }));
  expect(screen.queryByText('【私訊】活動剩餘便當')).toBeNull();
  await fireEvent.press(screen.getByRole('tab', { name: '私訊' }));
  expect(screen.getByText('【私訊】活動剩餘便當')).toBeTruthy();
});
it('opens a stealth conversation from the same row and exposes its organization options', async () => {
  const screen = await render(ui());
  await fireEvent.press(screen.getByRole('button', { name: '開啟 【偷揪】一起喝奶茶' }));
  expect(router.push).toHaveBeenCalledWith('/stealth-chat/stealth');
  await fireEvent.press(screen.getAllByRole('button', { name: '聊天室選項' })[1]);
  await fireEvent.press(screen.getByRole('button', { name: '移至主要' }));
  await waitFor(() =>
    expect(socialApi.preference).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'stealth', kind: 'stealth' }),
      { inbox: 'primary' },
    ),
  );
});
it('deletes only the selected conversation preference and offers undo', async () => {
  const screen = await render(ui());
  await fireEvent.press(screen.getAllByRole('button', { name: '聊天室選項' })[0]);
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
