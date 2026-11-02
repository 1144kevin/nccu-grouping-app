import { afterEach, expect, it, jest } from '@jest/globals';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CorePostImage, DraftImageManager } from './core-post-image';
import { mediaApi } from '@/lib/media-api';

let mockFocused = true;

jest.mock('@/store/auth-store', () => ({
  useAuthStore: Object.assign(
    (select: (s: unknown) => unknown) => select({ user: { id: 'synthetic-owner' } }),
    { getState: () => ({ user: { id: 'synthetic-owner' } }) },
  ),
}));
jest.mock('@/lib/core-hooks', () => ({ useCoreScreenFocused: () => mockFocused }));
jest.mock('@/lib/core-api', () => ({ coreError: () => '圖片暫時無法載入' }));
jest.mock('@/lib/font-size-storage', () => ({
  fontSizeStorage: { getItem: () => null, setItem: jest.fn(), removeItem: jest.fn() },
}));
jest.mock('@/lib/media-api', () => {
  const actual = jest.requireActual<typeof import('@/lib/media-api')>('@/lib/media-api');
  return { ...actual, mediaApi: { drafts: jest.fn(), remove: jest.fn(), link: jest.fn() } };
});
jest.mock('@/lib/api', () => ({ api: {} }));
const client = new QueryClient({
  defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } },
});
afterEach(async () => {
  await cleanup();
  await act(async () => {
    client.clear();
    await new Promise((r) => setTimeout(r, 0));
  });
  mockFocused = true;
  jest.clearAllMocks();
  jest.mocked(mediaApi.link).mockReset();
});

it('requires a second explicit action to delete only the selected unused cloud copy', async () => {
  jest.mocked(mediaApi.drafts).mockResolvedValue({
    items: [
      {
        id: 'unused-image',
        width: 480,
        height: 320,
        state: 'ready',
        created_at: '2026-10-19T01:00:00Z',
      },
    ],
  });
  jest.mocked(mediaApi.remove).mockResolvedValue({ deleted: true });
  const screen = await render(
    <QueryClientProvider client={client}>
      <DraftImageManager />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(screen.getByRole('button', { name: '刪除未發佈副本' })).toBeTruthy());
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '刪除未發佈副本' }));
  });
  expect(mediaApi.remove).not.toHaveBeenCalled();
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '保留副本' }));
  });
  expect(mediaApi.remove).not.toHaveBeenCalled();
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '刪除未發佈副本' }));
  });
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '確認刪除這份未發佈副本' }));
  });
  await waitFor(() => expect(mediaApi.remove).toHaveBeenCalledWith('unused-image'));
  expect(mediaApi.remove).toHaveBeenCalledTimes(1);
});

it('keeps a retry action when signing fails rather than displaying an untrusted image URL', async () => {
  jest.mocked(mediaApi.link).mockResolvedValue({
    id: 'image',
    width: 480,
    height: 320,
    expires_in: 60,
    url: 'https://foreign.example/private.jpg',
  });
  const screen = await render(
    <QueryClientProvider client={client}>
      <CorePostImage imageId="image" />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(screen.getByRole('button', { name: '重試圖片' })).toBeTruthy());
  expect(screen.queryByLabelText('拼單附圖')).toBeNull();
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '重試圖片' }));
  });
  await waitFor(() => expect(mediaApi.link).toHaveBeenCalledTimes(2));
});

const imageUrl = (source: { uri?: string } | { uri?: string }[]) =>
  Array.isArray(source) ? source[0]?.uri : source.uri;
const signedLink = (token: string) => ({
  id: 'image',
  width: 480,
  height: 320,
  expires_in: 60,
  url: `https://axdwbfhrkbovgrbngrrh.supabase.co/storage/v1/object/sign/core-post-images/00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002.jpg?token=${token}`,
});
it('keeps a cached image visible on route changes and refreshes its link only if download fails', async () => {
  mockFocused = false;
  client.setQueryData(['core', 'synthetic-owner', 'image-link', 'image'], signedLink('expired'), {
    updatedAt: Date.now() - 120000,
  });
  jest.mocked(mediaApi.link).mockResolvedValue(signedLink('fresh'));
  const view = () => (
    <QueryClientProvider client={client}>
      <CorePostImage imageId="image" />
    </QueryClientProvider>
  );
  const screen = await render(view());
  expect(screen.getByLabelText('拼單附圖')).toBeTruthy();
  expect(mediaApi.link).not.toHaveBeenCalled();
  mockFocused = true;
  await screen.rerender(view());
  expect(mediaApi.link).not.toHaveBeenCalled();
  await fireEvent(screen.getByLabelText('拼單附圖'), 'error', {
    nativeEvent: { error: 'expired' },
  });
  await waitFor(() =>
    expect(imageUrl(screen.getByLabelText('拼單附圖').props.source)).toBe(signedLink('fresh').url),
  );
  expect(screen.queryByRole('button', { name: '重試圖片' })).toBeNull();
});
it('automatically obtains a new link after an image download fails and clears the old attempt error', async () => {
  jest
    .mocked(mediaApi.link)
    .mockResolvedValueOnce(signedLink('first'))
    .mockResolvedValueOnce(signedLink('renewed'));
  const screen = await render(
    <QueryClientProvider client={client}>
      <CorePostImage imageId="image" />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(screen.getByLabelText('拼單附圖')).toBeTruthy());
  await fireEvent(screen.getByLabelText('拼單附圖'), 'error', {
    nativeEvent: { error: 'synthetic download failure' },
  });
  await waitFor(() =>
    expect(imageUrl(screen.getByLabelText('拼單附圖').props.source)).toBe(
      signedLink('renewed').url,
    ),
  );
  expect(mediaApi.link).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('button', { name: '重試圖片' })).toBeNull();
});
it('bounds automatic retries for a genuinely unavailable image and resets the error for another image', async () => {
  jest
    .mocked(mediaApi.link)
    .mockResolvedValueOnce(signedLink('first'))
    .mockResolvedValueOnce(signedLink('second'))
    .mockResolvedValue(signedLink('another'));
  const screen = await render(
    <QueryClientProvider client={client}>
      <CorePostImage imageId="image" />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(screen.getByLabelText('拼單附圖')).toBeTruthy());
  await fireEvent(screen.getByLabelText('拼單附圖'), 'error', {
    nativeEvent: { error: 'synthetic download failure' },
  });
  await waitFor(() =>
    expect(imageUrl(screen.getByLabelText('拼單附圖').props.source)).toBe(signedLink('second').url),
  );
  await fireEvent(screen.getByLabelText('拼單附圖'), 'error', {
    nativeEvent: { error: 'synthetic download failure' },
  });
  await waitFor(() => expect(screen.getByRole('button', { name: '重試圖片' })).toBeTruthy());
  expect(mediaApi.link).toHaveBeenCalledTimes(2);
  await screen.rerender(
    <QueryClientProvider client={client}>
      <CorePostImage imageId="another-image" />
    </QueryClientProvider>,
  );
  await waitFor(() =>
    expect(imageUrl(screen.getByLabelText('拼單附圖').props.source)).toBe(
      signedLink('another').url,
    ),
  );
  expect(screen.queryByRole('button', { name: '重試圖片' })).toBeNull();
});
