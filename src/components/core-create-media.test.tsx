import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import CreateScreen from '@/app/(tabs)/create';
import { mediaApi } from '@/lib/media-api';
import { coreApi } from '@/lib/core-api';
import { router } from 'expo-router';
import { AppState } from 'react-native';

let mockActor = 'synthetic-actor';
let mockAssets = [{ uri: 'synthetic://image', base64: 'YQ==', width: 480, height: 320 }];
let mockPickerOptions: Record<string, unknown> = {};
jest.mock('@/store/auth-store', () => ({
  useAuthStore: Object.assign(
    (select: (s: { user: { id: string } }) => unknown) => select({ user: { id: mockActor } }),
    { getState: () => ({ user: { id: mockActor } }) },
  ),
}));
jest.mock('@/store/app-store', () => ({
  useAppStore: (select: (s: unknown) => unknown) => select({ publishPost: jest.fn() }),
}));
jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
  useFocusEffect: (callback: () => () => void) => {
    jest.requireActual<typeof import('react')>('react').useEffect(callback, [callback]);
  },
}));
jest.mock('expo-audio', () => ({
  RecordingPresets: { HIGH_QUALITY: {} },
  useAudioRecorder: () => ({}),
  useAudioRecorderState: () => ({ isRecording: false }),
  requestRecordingPermissionsAsync: jest.fn(),
}));
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: async () => ({ granted: true }),
  launchImageLibraryAsync: async (options: Record<string, unknown>) => { mockPickerOptions = options; return { canceled: false, assets: mockAssets }; },
}));
jest.mock('@/components/location-picker', () => ({
  LocationPicker: ({ onChange }: { onChange: (p: unknown) => void }) => {
    const { Button } = jest.requireActual<typeof import('react-native')>('react-native');
    return (
      <Button
        title="確認測試取餐點"
        onPress={() =>
          onChange({
            name: '測試取餐點',
            latitude: 24.987,
            longitude: 121.576,
            address: '\n取餐說明：右側桌子',
          })
        }
      />
    );
  },
}));
jest.mock('@/components/deadline-picker', () => ({
  DeadlinePickerModal: () => null,
  createInitialDeadline: (n: number) => new Date(n + 3_600_000),
  startOfDay: (n: number) => new Date(n),
  formatDeadline: () => '未來截止時間',
}));
jest.mock('@/lib/core-clock', () => ({
  useCoreClock: () => ({ data: { driftMs: 0 }, now: () => 1_800_000_000_000 }),
}));
jest.mock('@/lib/core-hooks', () => ({ invalidateCore: jest.fn(async () => undefined) }));
jest.mock('@/lib/font-size-storage', () => ({
  fontSizeStorage: { getItem: () => null, setItem: jest.fn(), removeItem: jest.fn() },
}));
jest.mock('@/lib/core-api', () => ({
  CORE_API_ENABLED: true,
  CORE_SUPABASE_MODE: true,
  coreApi: { create: jest.fn() },
  coreError: () => '暫時失敗，保留草稿',
  newRequestKey: () => 'test-request-' + Math.random(),
}));
jest.mock('@/lib/media-api', () => ({
  mediaApi: { upload: jest.fn(), publish: jest.fn(), remove: jest.fn() },
  validPickedImage: (v: string) => v,
}));

beforeEach(() => {
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  mockActor = 'synthetic-actor';
  mockAssets = [{ uri: 'synthetic://image', base64: 'YQ==', width: 480, height: 320 }];
  mockPickerOptions = {};
  jest
    .mocked(mediaApi.upload)
    .mockResolvedValue({ id: 'image-id', state: 'ready', width: 480, height: 320 });
});
afterEach(() => {
  jest.resetAllMocks();
  jest.restoreAllMocks();
});

async function filledForm() {
  const screen = await render(<CreateScreen />);
  await act(async () => {
    await fireEvent.changeText(
      screen.getByLabelText('拼單內容'),
      '合成測試圖片拼單，沒有真實訂購或付款。',
    );
  });
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '確認測試取餐點' }));
  });
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '新增圖片' }));
  });
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '發布' }).props.accessibilityState?.disabled).toBe(
      false,
    ),
  );
  return screen;
}

it('retains image and publication key after a failed publication without uploading again', async () => {
  jest
    .mocked(mediaApi.publish)
    .mockRejectedValueOnce(new Error('synthetic temporary failure'))
    .mockResolvedValueOnce({ id: 'post-id' } as never);
  const screen = await filledForm();
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '發布' }));
  });
  await waitFor(() => expect(screen.getByText('暫時失敗，保留草稿')).toBeTruthy());
  expect(screen.getByLabelText('拼單內容').props.value).toContain('合成測試');
  expect(router.replace).not.toHaveBeenCalled();
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '發布' }));
  });
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
  expect(mediaApi.upload).toHaveBeenCalledTimes(1);
  expect(mediaApi.publish).toHaveBeenCalledTimes(2);
  expect(jest.mocked(mediaApi.publish).mock.calls[0]).toEqual(
    jest.mocked(mediaApi.publish).mock.calls[1],
  );
  expect(coreApi.create).not.toHaveBeenCalled();
});

it('does not publish an old account image if identity changes during upload', async () => {
  jest.mocked(mediaApi.upload).mockImplementationOnce(async () => {
    mockActor = 'different-synthetic-actor';
    return { id: 'old-account-image', state: 'ready', width: 480, height: 320 };
  });
  const screen = await filledForm();
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '發布' }));
  });
  await waitFor(() => expect(screen.getByText('暫時失敗，保留草稿')).toBeTruthy());
  expect(mediaApi.publish).not.toHaveBeenCalled();
  expect(coreApi.create).not.toHaveBeenCalled();
  expect(router.replace).not.toHaveBeenCalled();
});

it('resumes a partially uploaded album and publishes all photos in selection order', async () => {
  mockAssets = Array.from({ length: 3 }, (_, i) => ({ uri: `synthetic://image-${i}`, base64: 'YQ==', width: i % 2 ? 1200 : 800, height: i % 2 ? 800 : 1200 }));
  jest.mocked(mediaApi.upload)
    .mockResolvedValueOnce({ id: 'first', state: 'ready', width: 800, height: 1200 })
    .mockRejectedValueOnce(new Error('temporary network failure'))
    .mockResolvedValueOnce({ id: 'second', state: 'ready', width: 1200, height: 800 })
    .mockResolvedValueOnce({ id: 'third', state: 'ready', width: 800, height: 1200 });
  jest.mocked(mediaApi.publish).mockResolvedValueOnce({ id: 'post' } as never);
  const screen = await filledForm();
  expect(mockPickerOptions).toEqual(expect.objectContaining({ allowsMultipleSelection: true, selectionLimit: 5, allowsEditing: false, orderedSelection: true }));
  await act(async () => { await fireEvent.press(screen.getByRole('button', { name: '發布' })); });
  await waitFor(() => expect(screen.getByText('暫時失敗，保留草稿')).toBeTruthy());
  expect(mediaApi.publish).not.toHaveBeenCalled();
  await act(async () => { await fireEvent.press(screen.getByRole('button', { name: '發布' })); });
  await waitFor(() => expect(mediaApi.publish).toHaveBeenCalledWith(expect.anything(), ['first', 'second', 'third'], expect.any(String)));
  expect(mediaApi.upload).toHaveBeenCalledTimes(4);
  expect(jest.mocked(mediaApi.upload).mock.calls[1]).toEqual(jest.mocked(mediaApi.upload).mock.calls[2]);
});

it('caps selection at five and allows removing an individual photo before publishing', async () => {
  mockAssets = Array.from({ length: 5 }, (_, i) => ({ uri: `synthetic://image-${i}`, base64: 'YQ==', width: 480, height: 320 }));
  const screen = await filledForm();
  expect(screen.getByRole('button', { name: '新增圖片' }).props.accessibilityState?.disabled).toBe(true);
  await act(async () => { await fireEvent(screen.getByTestId('post-photo-carousel'), 'layout', { nativeEvent: { layout: { width: 360 } } }); });
  await act(async () => { await fireEvent.press(screen.getByRole('button', { name: '移除第 3 張圖片' })); });
  expect(screen.getByRole('button', { name: '新增圖片' }).props.accessibilityState?.disabled).toBe(false);
  expect(screen.getByText(/已選 4\/5 張/)).toBeTruthy();
  expect(mediaApi.remove).not.toHaveBeenCalled();
});
