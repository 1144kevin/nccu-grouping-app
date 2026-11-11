import { expect, it, jest } from '@jest/globals';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { PostComposer } from './post-composer';
import { coreApi, type CorePost } from '@/lib/core-api';
import { router } from 'expo-router';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn() },
}));
jest.mock('expo-audio', () => ({
  RecordingPresets: { HIGH_QUALITY: {} },
  useAudioRecorder: () => ({}),
  useAudioRecorderState: () => ({ isRecording: false }),
}));
jest.mock('@/lib/core-api', () => ({
  CORE_API_ENABLED: true,
  CORE_SUPABASE_MODE: true,
  coreApi: { edit: jest.fn() },
  coreError: () => '儲存失敗',
  newRequestKey: () => 'test-key',
}));
jest.mock('@/lib/core-hooks', () => ({
  invalidateCore: jest.fn(async () => undefined),
  useCoreScreenFocused: () => true,
}));
jest.mock('@/store/auth-store', () => ({
  useAuthStore: Object.assign(
    (select: (s: object) => unknown) => select({ user: { id: 'owner' } }),
    { getState: () => ({ user: { id: 'owner' } }) },
  ),
}));
jest.mock('@/components/location-picker', () => ({ LocationPicker: () => null }));
jest.mock('@/components/post-writing-assistant', () => ({ PostWritingAssistant: () => null }));
jest.mock('@/components/core-post-image', () => ({ CorePostImage: () => null }));
jest.mock('@/lib/font-size-storage', () => ({
  fontSizeStorage: { getItem: () => null, setItem: jest.fn(), removeItem: jest.fn() },
}));

const post = {
  id: 'post',
  author_id: 'owner',
  author_name: '主揪',
  content: '一起吃午餐與分享優惠',
  tags: ['拼單'],
  location: { name: '政大正門', latitude: 24.98, longitude: 121.57, address: null, source: null },
  price_per_person: '80',
  deadline_at: '2030-01-01T12:00:00Z',
  capacity: 3,
  joined: 1,
  status: 'open',
  my_status: 'host',
  can_edit: true,
  version: 1,
  created_at: '2026-01-01T00:00:00Z',
} as unknown as CorePost;

it('allows saving a post whose stored location has nullable optional fields', async () => {
  jest.mocked(coreApi.edit).mockResolvedValue(post);
  const screen = await render(
    <PostComposer post={post} now={() => Date.parse('2029-01-01T00:00:00Z')} />,
  );
  expect(screen.getByRole('button', { name: '儲存拼單變更' })).toBeEnabled();
  await fireEvent.press(screen.getByRole('button', { name: '儲存拼單變更' }));
  await waitFor(() =>
    expect(coreApi.edit).toHaveBeenCalledWith(
      'post',
      expect.objectContaining({
        location: expect.objectContaining({
          name: '政大正門',
          address: undefined,
          source: undefined,
        }),
        price_per_person: '80',
        expected_version: 1,
      }),
    ),
  );
}, 15000);

it('allows closing a locked post instead of trapping its owner', async () => {
  const screen = await render(<PostComposer post={{ ...post, can_edit: false }} />);
  expect(screen.getByRole('button', { name: '關閉' })).toBeEnabled();
  await fireEvent.press(screen.getByRole('button', { name: '關閉' }));
  expect(router.back).toHaveBeenCalled();
});

it('shows a working web confirmation before discarding edits', async () => {
  const previous = Platform.OS;
  Platform.OS = 'web';
  const confirm = jest.fn(() => true);
  window.confirm = confirm;
  const screen = await render(<PostComposer post={post} />);
  await fireEvent.changeText(
    screen.getByPlaceholderText('分享想揪的餐點、價格、取餐地點等資訊...'),
    '更新後的午餐內容與分享優惠',
  );
  await fireEvent.press(screen.getByRole('button', { name: '關閉' }));
  expect(confirm).toHaveBeenCalled();
  Platform.OS = previous;
});
