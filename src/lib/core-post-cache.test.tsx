import { afterEach, expect, it, jest } from '@jest/globals';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider, type InfiniteData } from '@tanstack/react-query';
import { Pressable, Text } from 'react-native';
import { updateCachedPost, usePostCacheSync } from './core-post-cache';
import { coreApi, type CorePost, type CorePostPage } from './core-api';
import { useCoreRecommendations } from './engagement-api';

let mockActor = 'viewer';
jest.mock('./core-api', () => ({
  CORE_API_ENABLED: true,
  CORE_SUPABASE_MODE: true,
  coreApi: { post: jest.fn() },
}));
jest.mock('./api', () => ({ api: { get: jest.fn() } }));
jest.mock('./core-hooks', () => ({ useCoreScreenFocused: () => true }));
jest.mock('@/store/auth-store', () => ({
  useAuthStore: Object.assign(
    (select: (s: { user: { id: string } }) => unknown) => select({ user: { id: mockActor } }),
    { getState: () => ({ user: { id: mockActor } }) },
  ),
}));
const client = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
});
const post = {
  id: 'target',
  version: 3,
  my_status: 'none',
  status: 'open',
  joined: 1,
  capacity: 2,
  images: [{ id: 'photo', width: 400, height: 300 }],
} as CorePost;
const other = { ...post, id: 'untouched' };
const key = ['core', 'viewer', 'recommendations', 1];
function seed() {
  client.setQueryData(key, {
    pages: [
      { items: [other], next_cursor: 'next' },
      { items: [post], next_cursor: null },
    ],
    pageParams: [undefined, 'next'],
  });
}
const cached = () => client.getQueryData<InfiniteData<CorePostPage>>(key)!;
afterEach(async () => {
  await cleanup();
  client.clear();
  mockActor = 'viewer';
  jest.resetAllMocks();
});

it('updates the same post across cached pages and the published pin without refetching images or changing order', () => {
  seed();
  client.setQueryData(['core', 'viewer', 'post', post.id], post);
  client.setQueryData(['core', 'viewer', 'newly-published-post'], post);
  client.setQueryData(['core', 'another-account', 'recommendations', 1], cached());
  client.setQueryData(['core', 'viewer', 'image-link', 'photo'], { url: 'cached-image' });
  const before = cached();
  const image = client.getQueryData(['core', 'viewer', 'image-link', 'photo']);
  updateCachedPost(client, 'viewer', { id: post.id, my_status: 'pending' });
  expect(cached().pages.flatMap((p) => p.items.map((p) => p.id))).toEqual(['untouched', 'target']);
  expect(cached().pages[0]).toBe(before.pages[0]);
  expect(cached().pageParams).toBe(before.pageParams);
  expect(cached().pages[1].items[0]).toMatchObject({ my_status: 'pending', joined: 1 });
  expect(cached().pages[1].items[0].images).toBe(before.pages[1].items[0].images);
  expect(client.getQueryData(['core', 'viewer', 'image-link', 'photo'])).toBe(image);
  expect(client.getQueryState(key)?.isInvalidated).toBe(false);
  expect(client.getQueryData(['core', 'viewer', 'post', post.id])).toMatchObject({
    my_status: 'pending',
  });
  expect(client.getQueryData(['core', 'viewer', 'newly-published-post'])).toMatchObject({
    my_status: 'pending',
  });
  expect(
    client.getQueryData<InfiniteData<CorePostPage>>([
      'core',
      'another-account',
      'recommendations',
      1,
    ])?.pages[1].items[0].my_status,
  ).toBe('none');
});

it('does not regress a post to an older server version', () => {
  seed();
  updateCachedPost(client, 'viewer', { ...post, version: 4, content: 'new content' });
  updateCachedPost(client, 'viewer', { ...post, version: 3, content: 'old content' });
  expect(cached().pages[1].items[0].content).toBe('new content');
});

function ReadRace() {
  const sync = usePostCacheSync();
  return (
    <>
      <Pressable onPress={() => void sync.refresh(post.id)}>
        <Text>refresh one</Text>
      </Pressable>
      <Pressable onPress={() => sync.update({ ...post, my_status: 'cancelled' })}>
        <Text>cancel</Text>
      </Pressable>
    </>
  );
}
it('ignores an old pending read that returns after a successful cancellation', async () => {
  seed();
  let finish!: (value: CorePost) => void;
  jest.mocked(coreApi.post).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const screen = await render(
    <QueryClientProvider client={client}>
      <ReadRace />
    </QueryClientProvider>,
  );
  await fireEvent.press(screen.getByText('refresh one'));
  await fireEvent.press(screen.getByText('cancel'));
  await act(async () => {
    finish({ ...post, my_status: 'pending' });
  });
  expect(cached().pages[1].items[0].my_status).toBe('cancelled');
});

it('discards a response after switching accounts', async () => {
  seed();
  let finish!: (value: CorePost) => void;
  jest.mocked(coreApi.post).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const screen = await render(
    <QueryClientProvider client={client}>
      <ReadRace />
    </QueryClientProvider>,
  );
  await fireEvent.press(screen.getByText('refresh one'));
  mockActor = 'another-account';
  await act(async () => {
    finish({ ...post, my_status: 'pending' });
  });
  expect(cached().pages[1].items[0].my_status).toBe('none');
});

function StableRecommendations() {
  const query = useCoreRecommendations(true);
  return <Text>{query.posts.map((p) => `${p.id}:${p.status}`).join(',')}</Text>;
}
it('keeps a now full or cancelled card in its existing position until manual refresh', async () => {
  seed();
  client.setQueryData(['core', 'viewer', 'preferences'], { version: 1 });
  const screen = await render(
    <QueryClientProvider client={client}>
      <StableRecommendations />
    </QueryClientProvider>,
  );
  expect(screen.getByText('untouched:open,target:open')).toBeTruthy();
  await act(async () => {
    updateCachedPost(client, 'viewer', {
      ...post,
      status: 'full',
      joined: 2,
      my_status: 'accepted',
    });
  });
  await waitFor(() => expect(screen.getByText('untouched:open,target:full')).toBeTruthy());
  await act(async () => {
    updateCachedPost(client, 'viewer', { ...post, status: 'cancelled' });
  });
  await waitFor(() => expect(screen.getByText('untouched:open,target:cancelled')).toBeTruthy());
});
