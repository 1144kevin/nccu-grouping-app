import { afterEach, expect, it, jest } from '@jest/globals';
import { fireEvent, render, waitFor, cleanup } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Linking, Share } from 'react-native';
import { PostShareButton } from './post-share-button';
import { postSharingApi } from '@/lib/post-sharing';
jest.mock('@/lib/post-sharing', () => ({ postSharingApi: { create: jest.fn() } }));
jest.mock('@/store/auth-store', () => ({
  useAuthStore: (selector: (s: object) => unknown) => selector({ user: { id: 'owner' } }),
}));
jest.mock('@/lib/font-size-storage', () => ({
  fontSizeStorage: { getItem: () => null, setItem: jest.fn(), removeItem: jest.fn() },
}));
let client: QueryClient;
afterEach(async () => {
  await cleanup();
  client?.clear();
  jest.restoreAllMocks();
  jest.clearAllMocks();
});
it('shares the created canonical post URL to LINE and the system sheet instead of text alone', async () => {
  const url = `https://campus-fixture.trycloudflare.com/s/${'a'.repeat(64)}`;
  jest.mocked(postSharingApi.create).mockResolvedValue(url);
  const line = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
  client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: 0 } } });
  const screen = await render(
    <QueryClientProvider client={client}>
      <PostShareButton postId="post" content="晚餐一起訂" />
    </QueryClientProvider>,
  );
  await fireEvent.press(screen.getByRole('button', { name: '分享貼文' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '分享到 LINE' })).toBeTruthy());
  expect(postSharingApi.create).toHaveBeenCalledWith('post');
  await fireEvent.press(screen.getByRole('button', { name: '分享到 LINE' }));
  expect(line).toHaveBeenCalledWith(`https://line.me/R/share?text=${encodeURIComponent(url)}`);
  await fireEvent.press(screen.getByRole('button', { name: '分享連結' }));
  expect(share).toHaveBeenCalledWith(expect.objectContaining({ url }));
});
