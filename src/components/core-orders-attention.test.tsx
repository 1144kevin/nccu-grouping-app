import { afterEach, expect, it, jest } from '@jest/globals';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { coreApi } from '@/lib/core-api';
import { CoreOrdersScreen } from './core-order-screens';

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
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), setParams: jest.fn() },
  useLocalSearchParams: () => ({}),
  Link: ({ children }: { children: unknown }) => children,
}));
jest.mock('@/lib/core-hooks', () => ({
  useCorePosts: () => ({ posts: [mockPost], isPending: false }),
  useCorePost: () => ({ data: { ...mockPost, id: 'older-page-post', content: '較早發布的晚餐團' } }),
  useCoreRequests: (id: string) => ({ data: id === 'older-page-post' ? [{ id: 'request-1', post_id: id, requester_id: 'applicant', requester_name: '小安', requester_badge: '🍍', status: 'pending', created_at: '2026-10-23T08:00:00Z' }] : [], isPending: false }),
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
  client.clear();
  jest.clearAllMocks();
});
jest.mock('@/lib/core-api', () => ({ coreApi: { decide: jest.fn(async () => ({})) }, coreError: () => '測試錯誤' }));
const client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: 0 }, queries: { gcTime: 0 } } });
const ui = () => <QueryClientProvider client={client}><CoreOrdersScreen /></QueryClientProvider>;
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
