import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  skipToken,
  type InfiniteData,
} from '@tanstack/react-query';
import { CorePostActions } from './core-post-actions';
import { coreApi, type CorePost, type CorePostPage } from '@/lib/core-api';
import { router } from 'expo-router';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

jest.mock('@/lib/core-api', () => ({
  coreApi: { requestJoin: jest.fn(), withdraw: jest.fn(), post: jest.fn() },
  coreError: () => '操作失敗',
}));
jest.mock('@/lib/core-hooks', () => ({ invalidateCore: jest.fn(async () => undefined) }));
jest.mock('@/store/auth-store', () => ({
  useAuthStore: Object.assign(
    (select: (s: { user: { id: string } }) => unknown) => select({ user: { id: 'viewer' } }),
    { getState: () => ({ user: { id: 'viewer' } }) },
  ),
}));
jest.mock('@/lib/font-size-storage', () => ({
  fontSizeStorage: { getItem: jest.fn(() => null), setItem: jest.fn(), removeItem: jest.fn() },
}));

const queryClient = new QueryClient({
  defaultOptions: { mutations: { retry: false, gcTime: 0 }, queries: { retry: false, gcTime: 0 } },
});
const post: CorePost = {
  id: 'p',
  author_id: 'host',
  author_name: '主揪',
  content: '一起訂晚餐',
  tags: ['晚餐'],
  location: { name: '測試點', latitude: 24.9, longitude: 121.5 },
  price_per_person: null,
  deadline_at: '2026-10-16T10:00:00Z',
  capacity: 2,
  joined: 1,
  status: 'open',
  my_status: 'none',
  created_at: '2026-10-16T08:00:00Z',
};

const feedKey = ['core', 'viewer', 'recommendations', 1];
function CachedFeedActions() {
  const { data } = useQuery<InfiniteData<CorePostPage>>({ queryKey: feedKey, queryFn: skipToken });
  return <CorePostActions post={data!.pages[0].items[0]} />;
}
function seedFeed(value = post) {
  queryClient.setQueryData(feedKey, {
    pages: [{ items: [value], next_cursor: null }],
    pageParams: [undefined],
  });
}
beforeEach(() => {
  jest.mocked(coreApi.post).mockRejectedValue(new Error('follow-up read unavailable'));
});

afterEach(async () => {
  await act(async () => {
    queryClient.clear();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  jest.clearAllMocks();
});

it('lets the host open management even after a post has closed', async () => {
  const screen = await render(
    <QueryClientProvider client={queryClient}>
      <CorePostActions post={{ ...post, status: 'expired', my_status: 'host' }} />
    </QueryClientProvider>,
  );
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '管理拼單' }));
  });
  expect(router.push).toHaveBeenCalledWith('/order/p');
  expect(coreApi.requestJoin).not.toHaveBeenCalled();
});

it('submits an application instead of pretending a pending user already occupies a seat', async () => {
  jest.mocked(coreApi.requestJoin).mockResolvedValue({ status: 'pending' } as never);
  seedFeed();
  const screen = await render(
    <QueryClientProvider client={queryClient}>
      <CachedFeedActions />
    </QueryClientProvider>,
  );
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '想被揪' }));
  });
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: '取消申請' }).props.accessibilityState?.disabled,
    ).toBe(false),
  );
  expect(coreApi.requestJoin).toHaveBeenCalledWith('p', 1);
  expect(coreApi.withdraw).not.toHaveBeenCalled();
  expect(
    queryClient.getQueryData<InfiniteData<CorePostPage>>(feedKey)?.pages[0].items[0].joined,
  ).toBe(1);
  jest.mocked(coreApi.withdraw).mockResolvedValue({ ...post, my_status: 'cancelled' });
  await fireEvent.press(screen.getByRole('button', { name: '取消申請' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '想被揪' })).toBeTruthy());
});

it('lets an accepted participant leave a full group', async () => {
  jest.mocked(coreApi.withdraw).mockResolvedValue(post);
  seedFeed({ ...post, status: 'full', joined: 2, my_status: 'accepted' });
  const screen = await render(
    <QueryClientProvider client={queryClient}>
      <CachedFeedActions />
    </QueryClientProvider>,
  );
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '退出並釋出名額' }));
  });
  expect(coreApi.withdraw).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: '確認退出拼單' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '想被揪' }).props.accessibilityState?.disabled).toBe(
      false,
    ),
  );
  expect(coreApi.withdraw).toHaveBeenCalledWith('p');
  expect(coreApi.requestJoin).not.toHaveBeenCalled();
});

it('keeps the original button state when the application fails', async () => {
  seedFeed();
  jest.mocked(coreApi.requestJoin).mockRejectedValueOnce(new Error('offline'));
  const screen = await render(
    <QueryClientProvider client={queryClient}>
      <CachedFeedActions />
    </QueryClientProvider>,
  );
  await fireEvent.press(screen.getByRole('button', { name: '想被揪' }));
  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  expect(screen.getByRole('button', { name: '想被揪' }).props.accessibilityState?.disabled).toBe(
    false,
  );
  expect(
    queryClient.getQueryData<InfiniteData<CorePostPage>>(feedKey)?.pages[0].items[0].my_status,
  ).toBe('none');
});

it('updates its own label even when the parent keeps the same post snapshot', async () => {
  jest.mocked(coreApi.requestJoin).mockResolvedValue({ status: 'pending' } as never);
  jest.mocked(coreApi.withdraw).mockResolvedValue({ ...post, my_status: 'cancelled' });
  const screen = await render(
    <QueryClientProvider client={queryClient}>
      <CorePostActions post={post} />
    </QueryClientProvider>,
  );
  await fireEvent.press(screen.getByRole('button', { name: '想被揪' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '取消申請' })).toBeTruthy(), {
    timeout: 700,
  });
  await fireEvent.press(screen.getByRole('button', { name: '取消申請' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '想被揪' })).toBeTruthy());
  await screen.rerender(
    <QueryClientProvider client={queryClient}>
      <CorePostActions post={{ ...post, my_status: 'accepted' }} />
    </QueryClientProvider>,
  );
  expect(screen.getByRole('button', { name: '退出並釋出名額' })).toBeTruthy();
});

it('keeps a confirmed application instead of overwriting it with a redundant stale read', async () => {
  seedFeed();
  jest.mocked(coreApi.requestJoin).mockResolvedValue({ status: 'pending' } as never);
  jest.mocked(coreApi.post).mockResolvedValue(post);
  const screen = await render(
    <QueryClientProvider client={queryClient}>
      <CachedFeedActions />
    </QueryClientProvider>,
  );
  await fireEvent.press(screen.getByRole('button', { name: '想被揪' }));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 80));
  });
  expect(screen.getByRole('button', { name: '取消申請' })).toBeTruthy();
  expect(coreApi.post).not.toHaveBeenCalled();
});

it.each(['cancelled'] as const)(
  'does not submit membership changes for a %s post',
  async (status) => {
    const screen = await render(
      <QueryClientProvider client={queryClient}>
        <CorePostActions post={{ ...post, status, my_status: 'accepted' }} />
      </QueryClientProvider>,
    );
    const button = screen.getByRole('button', { name: '已取消' });
    expect(button.props.accessibilityState?.disabled).toBe(true);
    await act(async () => {
      await fireEvent.press(button);
    });
    expect(coreApi.withdraw).not.toHaveBeenCalled();
  },
);
it('shows actual completed orders as completed and prevents membership changes', async () => {
  const screen = await render(
    <QueryClientProvider client={queryClient}>
      <CorePostActions
        post={{ ...post, completed: true, my_status: 'accepted', status: 'expired' }}
      />
    </QueryClientProvider>,
  );
  expect(screen.getByRole('button', { name: '已完成' }).props.accessibilityState?.disabled).toBe(
    true,
  );
});
it('opens post management from an embedded order card without pushing the order again', async () => {
  const screen = await render(
    <QueryClientProvider client={queryClient}>
      <CorePostActions
        post={{ ...post, my_status: 'host' }}
        onManage={() => router.push('/post/p')}
      />
    </QueryClientProvider>,
  );
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '管理拼單' }));
  });
  expect(router.push).toHaveBeenCalledWith('/post/p');
  expect(router.push).not.toHaveBeenCalledWith('/order/p');
  expect(coreApi.requestJoin).not.toHaveBeenCalled();
});
