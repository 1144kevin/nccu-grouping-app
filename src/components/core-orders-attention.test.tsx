import { afterEach, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';
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
  useCorePost: jest.fn(),
  useCoreRequests: jest.fn(),
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
  jest.clearAllMocks();
});
it('shows a pending post even outside the current post page, and routes directly to review', async () => {
  const screen = await render(<CoreOrdersScreen />);
  expect(screen.getByText('1 位夥伴等你審核')).toBeTruthy();
  expect(screen.getByLabelText('測試主揪 的頭像')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: '審核 較早發布的晚餐團 的 1 筆申請' }));
  expect(router.push).toHaveBeenCalledWith({
    pathname: '/order/[id]',
    params: { id: 'older-page-post', focus: 'requests' },
  });
});
it('filters the list to pending work without losing the actionable review card', async () => {
  const screen = await render(<CoreOrdersScreen />);
  await fireEvent.press(screen.getByRole('button', { name: '只看待處理' }));
  expect(screen.queryByText('普通拼單')).toBeNull();
  expect(screen.getByText('較早發布的晚餐團')).toBeTruthy();
  expect(screen.queryByText('開發示範拼單')).toBeNull();
});
