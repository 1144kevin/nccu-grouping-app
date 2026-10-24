import { afterEach, expect, it, jest } from '@jest/globals';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Text as MockText } from 'react-native';
import { CloudSearchScreen } from './cloud-search';
import { coreApi, type CorePost } from '@/lib/core-api';

let mockPosts: CorePost[] = [];
jest.mock('@/components/feed-post-card', () => ({
  FeedPostCard: ({ post }: { post: CorePost }) => (
    <MockText testID={`feed-card-${post.id}`}>{post.content}</MockText>
  ),
}));

jest.mock('@/components/core-semantic-feed', () => ({
  CoreSemanticFeed: () => {
    return <MockText>語義搜尋入口</MockText>;
  },
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/lib/core-hooks', () => ({
  useCoreScreenFocused: () => true,
  useCorePosts: () => ({ posts: mockPosts, isPending: false }),
}));
jest.mock('@/lib/core-api', () => ({
  coreApi: { search: jest.fn(), posts: jest.fn() },
  coreError: () => '操作失敗',
  toFeedPost: (post: unknown) => post,
}));
jest.mock('@/store/auth-store', () => ({
  useAuthStore: (selector: (state: { user: { id: string } }) => unknown) =>
    selector({ user: { id: 'synthetic-viewer' } }),
}));
jest.mock('@/lib/font-size-storage', () => ({
  fontSizeStorage: { getItem: jest.fn(() => null), setItem: jest.fn(), removeItem: jest.fn() },
}));
const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
afterEach(async () => {
  await cleanup();
  await act(async () => {
    client.clear();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  jest.clearAllMocks();
  mockPosts = [];
});

it('uses the home feed card for post search results instead of a separate role/status row', async () => {
  mockPosts = [{ id: 'found', content: '和首頁相同的完整貼文', my_status: 'host' } as CorePost];
  const screen = await render(
    <QueryClientProvider client={client}>
      <CloudSearchScreen initialScope="posts" initialQuery="晚餐" />
    </QueryClientProvider>,
  );
  expect(screen.getByTestId('feed-card-found')).toBeTruthy();
  expect(screen.queryByText('我主揪的')).toBeNull();
});

it('also reuses the home feed card inside all search results', async () => {
  jest
    .mocked(coreApi.posts)
    .mockResolvedValue({
      items: [{ id: 'found-all', content: '全部搜尋的完整貼文' } as CorePost],
      next_cursor: null,
    });
  jest.mocked(coreApi.search).mockResolvedValue({ items: [], next_cursor: null });
  const screen = await render(
    <QueryClientProvider client={client}>
      <CloudSearchScreen initialScope="all" initialQuery="晚餐" />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(screen.getByTestId('feed-card-found-all')).toBeTruthy());
});

it('only submits a scoped search after explicit search and opens the permitted group', async () => {
  jest.mocked(coreApi.search).mockResolvedValue({
    items: [
      {
        id: 'message-id',
        kind: 'message',
        title: '測試主揪',
        detail: '隔離私人訊息',
        post_id: 'synthetic-group',
        created_at: '2026-10-19T00:00:00Z',
      },
    ],
    next_cursor: null,
  });
  const screen = await render(
    <QueryClientProvider client={client}>
      <CloudSearchScreen initialScope="messages" />
    </QueryClientProvider>,
  );
  await act(async () => {
    await fireEvent.changeText(screen.getByLabelText('搜尋內容'), '隔離私人訊息');
  });
  expect(coreApi.search).not.toHaveBeenCalled();
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '搜尋' }));
  });
  await waitFor(() => expect(screen.getByText('隔離私人訊息')).toBeTruthy());
  expect(coreApi.search).toHaveBeenCalledWith('messages', '隔離私人訊息', undefined);
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '查看搜尋結果 測試主揪' }));
  });
  expect(router.push).toHaveBeenCalledWith('/chat/synthetic-group');
});

it('keeps the query and offers retry after a failed private search', async () => {
  jest.mocked(coreApi.search).mockRejectedValue(new Error('offline'));
  const screen = await render(
    <QueryClientProvider client={client}>
      <CloudSearchScreen initialScope="users" initialQuery="測試人物" />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(screen.getByText('操作失敗')).toBeTruthy());
  expect(screen.getByLabelText('搜尋內容').props.value).toBe('測試人物');
  expect(screen.getByRole('button', { name: '重試搜尋' })).toBeTruthy();
});

it('places semantic matching inside search while keeping normal scoped search separate', async () => {
  const screen = await render(
    <QueryClientProvider client={client}>
      <CloudSearchScreen />
    </QueryClientProvider>,
  );
  expect(screen.queryByText('語義搜尋入口')).toBeNull();
  await fireEvent.press(screen.getByRole('tab', { name: 'AI 找拼單' }));
  expect(screen.getByText('語義搜尋入口')).toBeTruthy();
  expect(screen.getAllByLabelText('搜尋內容')).toHaveLength(1);
  expect(screen.getByRole('tab', { name: '全部' })).toBeTruthy();
  expect(coreApi.search).not.toHaveBeenCalled();
});
