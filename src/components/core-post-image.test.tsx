import { afterEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CorePostImage, DraftImageManager } from './core-post-image';
import { mediaApi } from '@/lib/media-api';

jest.mock('@/store/auth-store', () => ({
  useAuthStore: Object.assign(
    (select: (s: unknown) => unknown) => select({ user: { id: 'synthetic-owner' } }),
    { getState: () => ({ user: { id: 'synthetic-owner' } }) },
  ),
}));
jest.mock('@/lib/core-hooks', () => ({ useCoreScreenFocused: () => true }));
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
  await act(async () => {
    client.clear();
    await new Promise((r) => setTimeout(r, 0));
  });
  jest.clearAllMocks();
});

it('requires a second explicit action to delete only the selected unused cloud copy', async () => {
  jest
    .mocked(mediaApi.drafts)
    .mockResolvedValue({
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
  jest
    .mocked(mediaApi.link)
    .mockResolvedValue({
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
