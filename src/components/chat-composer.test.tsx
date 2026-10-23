import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { ChatComposer } from './chat-composer';
import { chatPhotos } from '@/lib/chat-photos';

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 34 }) }));
jest.mock('@/lib/core-hooks', () => ({ useCoreScreenFocused: () => true }));
jest.mock('@/lib/core-api', () => ({
  coreError: () => '傳送失敗',
  newRequestKey: () => 'photo-request-retry-key',
}));
jest.mock('@/lib/chat-photos', () => ({
  chatPhotos: { upload: jest.fn(), send: jest.fn(), remove: jest.fn() },
}));
jest.mock('@/store/auth-store', () => ({
  useAuthStore: Object.assign(
    (select: (s: { user: { id: string } }) => unknown) => select({ user: { id: 'self' } }),
    { getState: () => ({ user: { id: 'self' } }) },
  ),
}));
jest.mock('@/lib/font-size-storage', () => ({
  fontSizeStorage: { getItem: () => null, setItem: jest.fn(), removeItem: jest.fn() },
}));
const client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: 0 } } });
const sent = jest.fn();
const ui = (kind: 'group' | 'direct' | 'stealth' = 'direct') => (
  <QueryClientProvider client={client}>
    <ChatComposer kind={kind} threadId="room" onSent={sent} />
  </QueryClientProvider>
);
beforeEach(() => {
  jest
    .mocked(ImagePicker.requestMediaLibraryPermissionsAsync)
    .mockResolvedValue({ granted: true } as never);
  jest
    .mocked(ImagePicker.launchImageLibraryAsync)
    .mockResolvedValue({
      canceled: false,
      assets: [
        { uri: 'data:image/jpeg;base64,aGVsbG8=', base64: 'aGVsbG8=', width: 20, height: 20 },
      ],
    } as never);
  jest
    .mocked(chatPhotos.upload)
    .mockResolvedValue({ id: 'photo', width: 20, height: 20, state: 'ready' });
  jest.mocked(chatPhotos.send).mockResolvedValue({ id: 'message' });
});
afterEach(() => {
  client.clear();
  jest.clearAllMocks();
});
it.each(['direct', 'group', 'stealth'] as const)(
  'previews and sends a photo to the correct %s chat',
  async (kind) => {
    const s = await render(ui(kind));
    await fireEvent.press(s.getByRole('button', { name: '傳送照片' }));
    await waitFor(() => expect(s.getByRole('button', { name: '取消' })).toBeTruthy());
    expect(chatPhotos.upload).not.toHaveBeenCalled();
    await fireEvent.press(s.getAllByRole('button', { name: '傳送照片' }).at(-1)!);
    await waitFor(() => expect(sent).toHaveBeenCalled());
    expect(chatPhotos.send).toHaveBeenCalledWith(kind, 'room', 'photo', 'photo-request-retry-key');
  },
);
it('retains an uploaded photo after send failure and reuses its key on retry', async () => {
  jest
    .mocked(chatPhotos.send)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ id: 'message' });
  const s = await render(ui());
  await fireEvent.press(s.getByRole('button', { name: '傳送照片' }));
  await waitFor(() => expect(s.getByRole('button', { name: '取消' })).toBeTruthy());
  await fireEvent.press(s.getAllByRole('button', { name: '傳送照片' }).at(-1)!);
  await waitFor(() => expect(s.getByText(/照片已保留/)).toBeTruthy());
  await fireEvent.press(s.getAllByRole('button', { name: '傳送照片' }).at(-1)!);
  await waitFor(() => expect(sent).toHaveBeenCalled());
  expect(chatPhotos.upload).toHaveBeenCalledTimes(1);
  expect(chatPhotos.send).toHaveBeenNthCalledWith(
    2,
    'direct',
    'room',
    'photo',
    'photo-request-retry-key',
  );
});
it('cancels a selected photo without sending or uploading it', async () => {
  const s = await render(ui());
  await fireEvent.press(s.getByRole('button', { name: '傳送照片' }));
  await waitFor(() => expect(s.getByRole('button', { name: '取消' })).toBeTruthy());
  await fireEvent.press(s.getByRole('button', { name: '取消' }));
  expect(chatPhotos.upload).not.toHaveBeenCalled();
  expect(chatPhotos.send).not.toHaveBeenCalled();
});
