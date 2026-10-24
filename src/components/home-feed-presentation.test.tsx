import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import HomeScreen from '@/app/(tabs)/index';
import { showPublishedPost } from '@/lib/feed-presentation';
import { queryClient } from '@/lib/query-client';
import type { CorePost } from '@/lib/core-api';

let mockActor = 'self';
let mockRanked: CorePost[] = [];
const mockRefetch = jest.fn(async () => undefined);
const makePost = (id: string, author = 'other', content = id) =>
  ({ id, author_id: author, content }) as CorePost;
jest.mock('react-native/Libraries/Components/RefreshControl/RefreshControl', () => ({
  __esModule: true,
  default: 'RefreshControl',
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (callback: () => void) => {
    jest.requireActual<typeof import('react')>('react').useEffect(callback, [callback]);
  },
}));
jest.mock('@/store/auth-store', () => ({
  useAuthStore: (select: (s: { user: { id: string } }) => unknown) =>
    select({ user: { id: mockActor } }),
}));
jest.mock('@/store/app-store', () => ({ useAppStore: jest.fn() }));
jest.mock('@/lib/core-api', () => ({
  CORE_API_ENABLED: true,
  CORE_SUPABASE_MODE: true,
  coreError: () => 'error',
  toFeedPost: (post: unknown) => post,
}));
jest.mock('@/lib/core-hooks', () => ({ useCorePosts: () => ({ posts: mockRanked }) }));
jest.mock('@/lib/engagement-api', () => ({
  useCoreRecommendations: () => ({ posts: mockRanked, refetch: mockRefetch, isPending: false }),
}));
jest.mock('@/components/feed-post-card', () => ({
  FeedPostCard: ({ post }: { post: CorePost }) => {
    const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return <Text testID={`post-${post.id}`}>{post.content}</Text>;
  },
}));
jest.mock('@/components/primitives', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { Screen: View, AppHeader: () => null, EmptyState: () => null, PrimaryButton: View };
});
jest.mock('@/lib/font-size-storage', () => ({
  fontSizeStorage: { getItem: () => null, setItem: jest.fn(), removeItem: jest.fn() },
}));
const app = () => (
  <QueryClientProvider client={queryClient}>
    <HomeScreen />
  </QueryClientProvider>
);
beforeEach(() => {
  mockActor = 'self';
  mockRanked = [makePost('ranked-a'), makePost('ranked-b')];
  mockRefetch.mockClear();
});
afterEach(async () => {
  await cleanup();
  await act(async () => {
    queryClient.clear();
    await new Promise((r) => setTimeout(r, 0));
  });
});

it('shows a new post even outside the recommendation page, keeps it through background updates, then restores ranking on pull', async () => {
  showPublishedPost('self', makePost('new', 'self'));
  const screen = await render(app());
  const ids = () => screen.getAllByTestId(/^post-/).map((item) => item.props.testID.slice(5));
  expect(ids()).toEqual(['new', 'ranked-a', 'ranked-b']);
  mockRanked = [makePost('ranked-b'), makePost('ranked-a')];
  await screen.rerender(app());
  expect(ids()).toEqual(['new', 'ranked-b', 'ranked-a']);
  await act(async () => {
    await fireEvent(screen.getByTestId('home-feed-refresh'), 'refresh');
  });
  await waitFor(() => expect(ids()).toEqual(['ranked-b', 'ranked-a']));
  expect(mockRefetch).toHaveBeenCalledTimes(1);
});
it('deduplicates a recommended new post and uses its current server copy', async () => {
  showPublishedPost('self', makePost('new', 'self', 'created copy'));
  mockRanked = [makePost('ranked-a'), makePost('new', 'self', 'updated server copy')];
  const screen = await render(app());
  expect(screen.getAllByTestId(/^post-/).map((item) => item.props.testID.slice(5))).toEqual([
    'new',
    'ranked-a',
  ]);
  expect(screen.getByTestId('post-new').props.children).toBe('updated server copy');
});
it('does not carry the temporary first post across accounts or a session reset', async () => {
  showPublishedPost('self', makePost('new', 'self'));
  const screen = await render(app());
  mockActor = 'another-account';
  await screen.rerender(app());
  expect(screen.queryByTestId('post-new')).toBeNull();
  await act(async () => {
    queryClient.clear();
  });
  mockActor = 'self';
  await screen.rerender(app());
  expect(screen.queryByTestId('post-new')).toBeNull();
});
