import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import CreateScreen from '@/app/(tabs)/create';
import { mediaApi } from '@/lib/media-api';
import { coreApi } from '@/lib/core-api';
import { router } from 'expo-router';
import { AppState } from 'react-native';
import { queryClient } from '@/lib/query-client';
import { PostComposer } from './post-composer';
import type { CorePost } from '@/lib/core-api';

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
  router: { replace: jest.fn(), canGoBack: () => false },
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
  launchImageLibraryAsync: async (options: Record<string, unknown>) => {
    mockPickerOptions = options;
    return { canceled: false, assets: mockAssets };
  },
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
  coreApi: { create: jest.fn(), edit: jest.fn() },
  coreError: () => '暫時失敗，保留草稿',
  newRequestKey: () => 'test-request-' + Math.random(),
}));
jest.mock('@/lib/media-api', () => ({
  mediaApi: {
    upload: jest.fn(),
    publish: jest.fn(),
    remove: jest.fn(),
    edit: jest.fn(),
    content: jest.fn(),
  },
  validPickedImage: (v: string) => v,
}));
jest.mock('./core-post-image', () => ({ CorePostImage: () => null }));

const editingPost = () =>
  ({
    id: 'existing-post',
    author_id: mockActor,
    content: '這是既有的拼單，編輯時要保留原本資料。',
    tags: ['午餐'],
    capacity: 3,
    price_per_person: '80',
    location: { name: '既有地點', latitude: 24.98, longitude: 121.57 },
    deadline_at: new Date(1_800_000_000_000 + 7200000).toISOString(),
    can_edit: true,
    my_status: 'host',
    version: 4,
    images: [{ id: 'original-image', width: 600, height: 800 }],
  }) as CorePost;

it('keeps the existing text edit API when the gallery is unchanged', async () => {
  const post = editingPost();
  jest.mocked(coreApi.edit).mockResolvedValue({ ...post, version: 5 });
  const screen = await render(<PostComposer post={post} now={() => 1_800_000_000_000} />);
  await fireEvent.changeText(
    screen.getByLabelText('拼單內容'),
    '只修改文字，其他拼單條件與圖片維持原樣。',
  );
  await fireEvent.press(screen.getByRole('button', { name: '儲存拼單變更' }));
  await waitFor(() =>
    expect(coreApi.edit).toHaveBeenCalledWith(
      post.id,
      expect.objectContaining({ expected_version: 4 }),
    ),
  );
  expect(mediaApi.edit).not.toHaveBeenCalled();
});

it('uses the same composer for editing and atomically saves original plus newly selected photos', async () => {
  const post = editingPost();
  jest.mocked(mediaApi.edit).mockResolvedValue({ ...post, version: 5 });
  const screen = await render(<PostComposer post={post} now={() => 1_800_000_000_000} />);
  expect(screen.getByLabelText('拼單內容').props.value).toBe(post.content);
  expect(screen.getByText('主題標籤')).toBeTruthy();
  expect(screen.getByRole('button', { name: '語音潤稿' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: '新增圖片' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '移除第 2 張圖片' })).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: '儲存拼單變更' }));
  await waitFor(() =>
    expect(mediaApi.edit).toHaveBeenCalledWith(
      post.id,
      expect.objectContaining({ content: post.content, tags: ['午餐'], capacity: 3 }),
      ['original-image', 'image-id'],
      4,
    ),
  );
  expect(mediaApi.publish).not.toHaveBeenCalled();
  expect(router.replace).toHaveBeenCalledWith('/order/existing-post');
});

it('removes existing images only when saving and leaves a failed edit available for retry', async () => {
  const post = editingPost();
  jest
    .mocked(mediaApi.edit)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ ...post, images: [], version: 5 });
  const screen = await render(<PostComposer post={post} now={() => 1_800_000_000_000} />);
  await fireEvent.press(screen.getByRole('button', { name: '移除第 1 張圖片' }));
  expect(mediaApi.remove).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: '儲存拼單變更' }));
  await waitFor(() => expect(screen.getByText('暫時失敗，保留草稿')).toBeTruthy());
  expect(router.replace).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: '儲存拼單變更' }));
  await waitFor(() => expect(mediaApi.edit).toHaveBeenCalledTimes(2));
  expect(jest.mocked(mediaApi.edit).mock.calls[0]).toEqual(
    jest.mocked(mediaApi.edit).mock.calls[1],
  );
});

it('locks shared edit controls while there are active applications or members', async () => {
  const screen = await render(
    <PostComposer post={{ ...editingPost(), can_edit: false }} now={() => 1_800_000_000_000} />,
  );
  expect(screen.getByRole('button', { name: '儲存拼單變更' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '新增圖片' })).toBeDisabled();
  expect(screen.getByLabelText('拼單內容').props.editable).toBe(false);
});

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
  queryClient.clear();
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
    .mockResolvedValueOnce({ id: 'post-id', author_id: 'synthetic-actor' } as never);
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
  expect(
    queryClient.getQueryData(['core', 'synthetic-actor', 'newly-published-post']),
  ).toMatchObject({ id: 'post-id' });
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
  mockAssets = Array.from({ length: 3 }, (_, i) => ({
    uri: `synthetic://image-${i}`,
    base64: 'YQ==',
    width: i % 2 ? 1200 : 800,
    height: i % 2 ? 800 : 1200,
  }));
  jest
    .mocked(mediaApi.upload)
    .mockResolvedValueOnce({ id: 'first', state: 'ready', width: 800, height: 1200 })
    .mockRejectedValueOnce(new Error('temporary network failure'))
    .mockResolvedValueOnce({ id: 'second', state: 'ready', width: 1200, height: 800 })
    .mockResolvedValueOnce({ id: 'third', state: 'ready', width: 800, height: 1200 });
  jest.mocked(mediaApi.publish).mockResolvedValueOnce({ id: 'post' } as never);
  const screen = await filledForm();
  expect(mockPickerOptions).toEqual(
    expect.objectContaining({
      allowsMultipleSelection: true,
      selectionLimit: 5,
      allowsEditing: false,
      orderedSelection: true,
    }),
  );
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '發布' }));
  });
  await waitFor(() => expect(screen.getByText('暫時失敗，保留草稿')).toBeTruthy());
  expect(mediaApi.publish).not.toHaveBeenCalled();
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '發布' }));
  });
  await waitFor(() =>
    expect(mediaApi.publish).toHaveBeenCalledWith(
      expect.anything(),
      ['first', 'second', 'third'],
      expect.any(String),
    ),
  );
  expect(mediaApi.upload).toHaveBeenCalledTimes(4);
  expect(jest.mocked(mediaApi.upload).mock.calls[1]).toEqual(
    jest.mocked(mediaApi.upload).mock.calls[2],
  );
});

it('caps selection at five and allows removing an individual photo before publishing', async () => {
  mockAssets = Array.from({ length: 5 }, (_, i) => ({
    uri: `synthetic://image-${i}`,
    base64: 'YQ==',
    width: 480,
    height: 320,
  }));
  const screen = await filledForm();
  expect(screen.getByRole('button', { name: '新增圖片' }).props.accessibilityState?.disabled).toBe(
    true,
  );
  expect(screen.getByLabelText('待發佈的圖片預覽 3').props.resizeMode).toBe('cover');
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '移除第 3 張圖片' }));
  });
  expect(screen.getByRole('button', { name: '新增圖片' }).props.accessibilityState?.disabled).toBe(
    false,
  );
  expect(screen.getByText('新增圖片\n(4/5)')).toBeTruthy();
  expect(mediaApi.remove).not.toHaveBeenCalled();
});

it('temporarily promotes a successful text-only publication as well as an image publication', async () => {
  jest
    .mocked(coreApi.create)
    .mockResolvedValueOnce({ id: 'text-post', author_id: 'synthetic-actor' } as never);
  const screen = await filledForm();
  await fireEvent.press(screen.getByRole('button', { name: '移除第 1 張圖片' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '發布' }).props.accessibilityState?.disabled).toBe(
      false,
    ),
  );
  await fireEvent.press(screen.getByRole('button', { name: '發布' }));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
  expect(mediaApi.publish).not.toHaveBeenCalled();
  expect(
    queryClient.getQueryData(['core', 'synthetic-actor', 'newly-published-post']),
  ).toMatchObject({ id: 'text-post' });
});
