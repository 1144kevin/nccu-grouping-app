import { afterEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, waitFor, cleanup } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from 'expo-router';
import { CoreOrderDetail } from './core-order-detail';
import { coreApi } from '@/lib/core-api';

let mockStatus = 'host';
let mockCanEdit = true;
let mockPostStatus = 'open';
const mockPost = () => ({
  id: 'p',
  author_id: 'owner',
  author_name: '主揪小王',
  author_level: 1,
  content: '晚餐一起訂',
  tags: [],
  created_at: '2026-10-25T10:00:00Z',
  deadline_at: '2026-10-26T10:00:00Z',
  location: { name: '正門' },
  capacity: 3,
  joined: 2,
  my_status: mockStatus,
  status: mockPostStatus,
  can_edit: mockCanEdit,
});
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({}),
}));
jest.mock('@/lib/core-hooks', () => ({
  useCorePost: () => ({ data: mockPost() }),
  useCoreRequests: () => ({ data: [] }),
  useCoreScreenFocused: () => true,
  invalidateCore: jest.fn(async () => undefined),
}));
jest.mock('@/lib/core-api', () => ({
  CORE_SUPABASE_MODE: true,
  coreApi: { cancel: jest.fn() },
  coreError: () => '失敗',
  toFeedPost: (p: object) => ({ ...p, name: '主揪小王', time: '剛剛', tags: [] }),
}));
jest.mock('@/store/auth-store', () => ({
  useAuthStore: Object.assign(
    (selector: (s: object) => unknown) =>
      selector({ user: { id: mockStatus === 'host' ? 'owner' : 'visitor' } }),
    { getState: () => ({ user: { id: mockStatus === 'host' ? 'owner' : 'visitor' } }) },
  ),
}));
jest.mock('@/lib/social-api', () => ({
  socialApi: { order: jest.fn(async () => ({ members: [], formed: true })), handoff: jest.fn() },
}));
jest.mock('@/lib/engagement-api', () => ({
  useSavedPostPreferences: () => ({ data: { items: [] } }),
  engagementApi: { savePost: jest.fn() },
}));
jest.mock('@/components/post-photo-carousel', () => ({
  CorePostGallery: () => null,
  PhotoCarousel: () => null,
}));
jest.mock('@/components/core-recommendation-reasons', () => ({
  CoreRecommendationReasons: () => null,
}));
jest.mock('@/components/post-location', () => ({ PostInfo: () => null }));
jest.mock('@/components/message-host-button', () => ({ MessageHostButton: () => null }));
jest.mock('@/components/core-profile', () => ({ postEmoji: () => '🍱' }));
jest.mock('@/lib/font-size-storage', () => ({
  fontSizeStorage: { getItem: () => null, setItem: jest.fn(), removeItem: jest.fn() },
}));
jest.mock('react-native-safe-area-context', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SafeAreaView: require('react-native').View,
}));
let client: QueryClient;
async function mount() {
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  const screen = await render(
    <QueryClientProvider client={client}>
      <CoreOrderDetail id="p" />
    </QueryClientProvider>,
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return screen;
}
afterEach(async () => {
  await cleanup();
  client?.clear();
  jest.clearAllMocks();
  mockStatus = 'host';
  mockCanEdit = true;
  mockPostStatus = 'open';
});
it('integrates host controls, hides self reporting and keeps only one order chat entry', async () => {
  jest.mocked(coreApi.cancel).mockResolvedValue({} as never);
  const screen = await mount();
  expect(screen.getAllByRole('button', { name: '編輯拼單' })).toHaveLength(1);
  expect(screen.getAllByRole('button', { name: '進入拼單聊天室' })).toHaveLength(1);
  expect(screen.queryByText('管理貼文')).toBeNull();
  expect(screen.queryByText('管理拼單')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: '編輯拼單' }));
  expect(router.push).toHaveBeenCalledWith('/edit-post/p');
  await fireEvent.press(screen.getByRole('button', { name: '貼文選項' }));
  expect(screen.queryByText('檢舉貼文')).toBeNull();
  await fireEvent.press(screen.getByLabelText('關閉貼文選項', { includeHiddenElements: true }));
  await fireEvent.press(screen.getByRole('button', { name: '取消拼單' }));
  expect(coreApi.cancel).not.toHaveBeenCalled();
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '確認取消拼單' }));
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  await waitFor(() => expect(coreApi.cancel).toHaveBeenCalledWith('p'));
});
it('keeps report available to visitors without showing host controls', async () => {
  mockStatus = 'none';
  const screen = await mount();
  expect(screen.queryByRole('button', { name: '編輯拼單' })).toBeNull();
  expect(screen.queryByRole('button', { name: '取消拼單' })).toBeNull();
  expect(screen.queryByRole('button', { name: '進入拼單聊天室' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: '貼文選項' }));
  expect(screen.getByText('檢舉貼文')).toBeTruthy();
});
it('honors edit permission and disables cancellation once closed', async () => {
  mockCanEdit = false;
  mockPostStatus = 'cancelled';
  const screen = await mount();
  expect(screen.queryByRole('button', { name: '編輯拼單' })).toBeNull();
  expect(screen.queryByRole('button', { name: '取消拼單' })).toBeNull();
});
