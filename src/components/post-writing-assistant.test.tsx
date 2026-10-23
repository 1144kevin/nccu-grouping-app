import { afterEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { PostWritingAssistant } from './post-writing-assistant';
import { socialApi } from '@/lib/social-api';

let mockActor = 'self';
jest.mock('@/store/auth-store', () => ({
  useAuthStore: Object.assign(
    (select: (s: { user: { id: string } }) => unknown) => select({ user: { id: mockActor } }),
    { getState: () => ({ user: { id: mockActor } }) },
  ),
}));
jest.mock('@/lib/social-api', () => ({ socialApi: { writePost: jest.fn() } }));
jest.mock('@/lib/core-api', () => ({ coreError: () => '暫時失敗' }));
jest.mock('@/lib/font-size-storage', () => ({
  fontSizeStorage: { getItem: () => null, setItem: jest.fn(), removeItem: jest.fn() },
}));
afterEach(() => {
  jest.resetAllMocks();
  mockActor = 'self';
});
it('only calls the local writer after a click and requires explicit draft adoption', async () => {
  jest.mocked(socialApi.writePost).mockResolvedValue({ text: '整理後的活動剩餘便當公告' });
  const onApply = jest.fn();
  const screen = await render(
    <PostWritingAssistant content="活動剩餘便當" context="" disabled={false} onApply={onApply} />,
  );
  expect(socialApi.writePost).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'AI 生成貼文' }));
  await waitFor(() =>
    expect(screen.getByLabelText('AI 貼文草稿').props.value).toBe('整理後的活動剩餘便當公告'),
  );
  expect(onApply).not.toHaveBeenCalled();
  await fireEvent.changeText(screen.getByLabelText('AI 貼文草稿'), '自行確認後的便當公告');
  await fireEvent.press(screen.getByRole('button', { name: '採用草稿' }));
  expect(onApply).toHaveBeenCalledWith('自行確認後的便當公告');
});
it('discards a late model response if the user changes the source', async () => {
  let resolve!: (v: { text: string }) => void;
  jest.mocked(socialApi.writePost).mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const onApply = jest.fn();
  const props = { context: '', disabled: false, onApply };
  const screen = await render(<PostWritingAssistant {...props} content="原本便當" />);
  await fireEvent.press(screen.getByRole('button', { name: 'AI 潤稿' }));
  await screen.rerender(<PostWritingAssistant {...props} content="改為披薩" />);
  await act(async () => resolve({ text: '過期的便當草稿' }));
  expect(screen.queryByLabelText('AI 貼文草稿')).toBeNull();
  expect(onApply).not.toHaveBeenCalled();
  expect(screen.getByText('內容已變更，請重新生成。')).toBeTruthy();
});
