import { afterEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { coreApi } from '@/lib/core-api';
import { CoreOrdersScreen, ParticipatingOrderRow } from './core-order-screens';
import type { CorePost } from '@/lib/core-api';

let mockClosed = false;
const mockPost = {
  id: 'visible-post',
  author_id: 'host',
  author_name: '測試主揪',
  content: '普通拼單',
  tags: ['便當'],
  location: { name: '正門' },
  price_per_person: '90',
  deadline_at: '2026-10-24T10:00:00Z',
  joined: 1,
  capacity: 3,
  status: 'open',
  my_status: 'host',
};
jest.mock('@/lib/core-clock', () => ({
  useCoreClock: () => ({ now: () => Date.parse('2026-10-23T08:00:00Z') }),
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), setParams: jest.fn() },
  useLocalSearchParams: () => ({}),
  Link: ({ children }: { children: unknown }) => children,
}));
jest.mock('@/lib/core-hooks', () => ({
  useCorePosts: () => ({
    posts: [
      mockClosed
        ? { ...mockPost, status: 'expired', deadline_at: '2020-01-01T00:00:00Z' }
        : mockPost,
    ],
    isPending: false,
  }),
  useCorePost: () => ({
    data: {
      ...mockPost,
      ...(mockClosed ? { status: 'expired', deadline_at: '2020-01-01T00:00:00Z' } : {}),
      id: 'older-page-post',
      content: '較早發布的晚餐團',
    },
  }),
  useCoreRequests: (id: string) => ({
    data:
      id === 'older-page-post'
        ? [
            {
              id: 'request-1',
              post_id: id,
              requester_id: 'applicant',
              requester_name: '小安',
              requester_badge: '🍍',
              status: 'pending',
              created_at: '2026-10-23T08:00:00Z',
            },
          ]
        : [],
    isPending: false,
  }),
  invalidateCore: jest.fn(async () => undefined),
}));
jest.mock('@/lib/core-chat-hooks', () => ({
  useCoreOrderActivity: () => ({
    groups: [{ postId: 'older-page-post', content: '較早發布的晚餐團', names: ['小安'], count: 1 }],
    pendingCount: 1,
  }),
}));
jest.mock('@/lib/font-size-storage', () => ({
  fontSizeStorage: { getItem: () => null, setItem: jest.fn(), removeItem: jest.fn() },
}));
afterEach(() => {
  mockClosed = false;
  client.clear();
  jest.clearAllMocks();
});
jest.mock('@/lib/core-api', () => ({
  coreApi: { decide: jest.fn(async () => ({})) },
  coreError: () => '測試錯誤',
}));
const client = new QueryClient({
  defaultOptions: { mutations: { retry: false, gcTime: 0 }, queries: { gcTime: 0 } },
});
const ui = () => (
  <QueryClientProvider client={client}>
    <CoreOrdersScreen />
  </QueryClientProvider>
);
it('shows applicants from an older page and accepts inline without opening order detail', async () => {
  const screen = await render(ui());
  expect(screen.getByText('較早發布的晚餐團')).toBeTruthy();
  expect(screen.getByLabelText('小安 的頭像')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: '接受' }));
  await waitFor(() => expect(coreApi.decide).toHaveBeenCalledWith('request-1', 'accepted'));
  expect(router.push).not.toHaveBeenCalled();
});
it('opens applicant profiles and full member/post detail from their own controls', async () => {
  const screen = await render(ui());
  await fireEvent.press(screen.getByRole('button', { name: '查看 小安 的公開資料' }));
  expect(router.push).toHaveBeenCalledWith('/user/applicant');
  await fireEvent.press(screen.getByRole('button', { name: '查看完整拼單 較早發布的晚餐團' }));
  expect(router.push).toHaveBeenCalledWith('/order/older-page-post');
  expect(screen.getByRole('tab', { name: '我主揪的 (1)' })).toBeTruthy();
});

it('omits expired orders even when stale activity still mentions pending requests', async () => {
  mockClosed = true;
  const screen = await render(ui());
  expect(screen.queryByText('較早發布的晚餐團')).toBeNull();
  expect(screen.queryByRole('button', { name: '接受' })).toBeNull();
});

it('shows participation as a compact host/content/status row with separate profile access', async () => {
  const s = await render(
    <ParticipatingOrderRow post={{ ...mockPost, my_status: 'pending' } as CorePost} />,
  );
  expect(s.getByText('待接受')).toBeTruthy();
  expect(s.getByText('普通拼單')).toBeTruthy();
  expect(s.queryByText('取餐地點')).toBeNull();
  await fireEvent.press(s.getByRole('button', { name: '查看 測試主揪 的公開資料' }));
  expect(router.push).toHaveBeenCalledWith('/user/host');
  await fireEvent.press(s.getByRole('button', { name: '查看拼單 普通拼單' }));
  expect(router.push).toHaveBeenCalledWith('/order/visible-post');
});

it('removes the entire applicant row before a slow acceptance completes', async () => {
  let resolve!: (v: never) => void;
  jest.mocked(coreApi.decide).mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const screen = await render(ui());
  await fireEvent.press(screen.getByRole('button', { name: '接受' }));
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: '查看 小安 的公開資料' })).toBeNull(),
  );
  expect(screen.getAllByText('沒有待處理的申請').length).toBeGreaterThan(0);
  await act(async () => resolve({} as never));
});
it('restores the applicant row when an optimistic rejection fails', async () => {
  let reject!: (e: Error) => void;
  jest.mocked(coreApi.decide).mockImplementationOnce(
    () =>
      new Promise((_r, fail) => {
        reject = fail;
      }),
  );
  const screen = await render(ui());
  await fireEvent.press(screen.getByRole('button', { name: '拒絕 小安 的申請' }));
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: '查看 小安 的公開資料' })).toBeNull(),
  );
  await act(async () => reject(new Error('offline')));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '查看 小安 的公開資料' })).toBeTruthy(),
  );
  expect(screen.getByText(/申請已恢復，可重試/)).toBeTruthy();
});
