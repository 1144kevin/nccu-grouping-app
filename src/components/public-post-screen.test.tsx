import { afterEach, expect, it, jest } from '@jest/globals';
import { fireEvent, render, waitFor, cleanup } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from 'expo-router';
import { postSharingApi } from '@/lib/post-sharing';
import { rememberSharedPost } from '@/lib/post-login-return';
import { PublicPostScreen } from './public-post-screen';

const id = '11111111-1111-4111-8111-111111111111';
const token = 'a'.repeat(64);
let mockUser: { profile_setup_required: boolean } | null = null;
jest.mock('expo-router', () => ({ router: { push: jest.fn() }, Redirect: () => null }));
jest.mock('@/store/auth-store', () => ({
  useAuthStore: (selector: (s: object) => unknown) => selector({ user: mockUser }),
}));
jest.mock('@/lib/post-sharing', () => ({
  SHARE_TOKEN: /^[0-9a-f]{64}$/,
  postSharingApi: { read: jest.fn() },
  sharedImageURL: () => '/test.jpg',
}));
jest.mock('@/lib/post-login-return', () => ({ rememberSharedPost: jest.fn() }));
jest.mock('@/components/post-photo-carousel', () => ({ PhotoCarousel: () => null }));
jest.mock('@/lib/font-size-storage', () => ({
  fontSizeStorage: { getItem: () => null, setItem: jest.fn(), removeItem: jest.fn() },
}));
jest.mock('react-native-safe-area-context', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SafeAreaView: require('react-native').View,
  useSafeAreaInsets: () => ({ bottom: 20 }),
}));
let client: QueryClient;
async function mount() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <PublicPostScreen token={token} />
    </QueryClientProvider>,
  );
}
afterEach(async () => {
  await cleanup();
  client?.clear();
  jest.clearAllMocks();
  mockUser = null;
});
it('shows the complete guest post with a persistent signup prompt and sends every action to sign in', async () => {
  jest
    .mocked(postSharingApi.read)
    .mockResolvedValue({
      id,
      author_name: '小王',
      author_badge: '🍱',
      author_level: 1,
      content: '今天一起拼晚餐',
      tags: ['晚餐'],
      created_at: '2026-10-25T10:00:00Z',
      deadline_at: '2026-10-26T10:00:00Z',
      capacity: 3,
      joined: 1,
      price_per_person: '85',
      location_name: '正門',
      status: 'open',
      images: [],
    });
  const screen = await mount();
  await waitFor(() => expect(screen.getByText('今天一起拼晚餐')).toBeTruthy());
  expect(screen.getByText('想一起拼單？')).toBeTruthy();
  for (const name of ['想被揪', '私訊主揪', '分享貼文', '註冊／登入']) {
    await fireEvent.press(screen.getByRole('button', { name }));
    expect(router.push).toHaveBeenLastCalledWith('/sign-in');
    expect(rememberSharedPost).toHaveBeenLastCalledWith(id);
  }
});
it('shows an unavailable state without leaking response details', async () => {
  jest.mocked(postSharingApi.read).mockRejectedValue(new Error('private-database-error'));
  const screen = await mount();
  await waitFor(() => expect(screen.getByText('這篇貼文目前無法查看')).toBeTruthy());
  expect(screen.queryByText('private-database-error')).toBeNull();
});
