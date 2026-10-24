import { afterEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CorePostActions } from './core-post-actions';
import { coreApi, type CorePost } from '@/lib/core-api';
import { router } from 'expo-router';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

jest.mock('@/lib/core-api', () => ({
  coreApi: { requestJoin: jest.fn(), withdraw: jest.fn() },
  coreError: () => '操作失敗',
}));
jest.mock('@/lib/core-hooks', () => ({ invalidateCore: jest.fn(async () => undefined) }));
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
  jest.mocked(coreApi.requestJoin).mockResolvedValue({} as never);
  const screen = await render(
    <QueryClientProvider client={queryClient}>
      <CorePostActions post={post} />
    </QueryClientProvider>,
  );
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '想被揪' }));
  });
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '想被揪' }).props.accessibilityState?.disabled).toBe(
      false,
    ),
  );
  expect(coreApi.requestJoin).toHaveBeenCalledWith('p', 1);
  expect(coreApi.withdraw).not.toHaveBeenCalled();
  await screen.rerender(
    <QueryClientProvider client={queryClient}>
      <CorePostActions post={{ ...post, my_status: 'pending' }} />
    </QueryClientProvider>,
  );
  expect(screen.getByRole('button', { name: '取消申請' })).toBeTruthy();
});

it('lets an accepted participant leave a full group', async () => {
  jest.mocked(coreApi.withdraw).mockResolvedValue(post);
  const screen = await render(
    <QueryClientProvider client={queryClient}>
      <CorePostActions post={{ ...post, status: 'full', joined: 2, my_status: 'accepted' }} />
    </QueryClientProvider>,
  );
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '退出並釋出名額' }));
  });
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: '退出並釋出名額' }).props.accessibilityState?.disabled,
    ).toBe(false),
  );
  expect(coreApi.withdraw).toHaveBeenCalledWith('p');
  expect(coreApi.requestJoin).not.toHaveBeenCalled();
});

it.each(['expired', 'cancelled'] as const)(
  'does not submit membership changes for a %s post',
  async (status) => {
    const screen = await render(
      <QueryClientProvider client={queryClient}>
        <CorePostActions post={{ ...post, status, my_status: 'accepted' }} />
      </QueryClientProvider>,
    );
    const button = screen.getByRole('button', { name: status === 'expired' ? '已截止' : '已取消' });
    expect(button.props.accessibilityState?.disabled).toBe(true);
    await act(async () => {
      await fireEvent.press(button);
    });
    expect(coreApi.withdraw).not.toHaveBeenCalled();
  },
);
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
