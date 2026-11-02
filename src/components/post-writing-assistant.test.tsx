import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { AppState } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { PostWritingAssistant } from './post-writing-assistant';
import { socialApi } from '@/lib/social-api';
import { startPostSpeech } from '@/lib/post-speech';
import type { SpeechCallbacks } from '@/lib/post-speech.types';

let mockActor = 'self';
jest.mock('@/store/auth-store', () => ({
  useAuthStore: Object.assign(
    (select: (s: { user: { id: string } }) => unknown) => select({ user: { id: mockActor } }),
    { getState: () => ({ user: { id: mockActor } }) },
  ),
}));
jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => () => void) => {
    jest.requireActual<typeof import('react')>('react').useEffect(callback, [callback]);
  },
}));
jest.mock('@/lib/social-api', () => ({ socialApi: { writePost: jest.fn() } }));
jest.mock('@/lib/post-speech', () => ({ startPostSpeech: jest.fn() }));
jest.mock('@/lib/core-api', () => ({ coreError: () => '暫時失敗' }));
jest.mock('@/lib/font-size-storage', () => ({
  fontSizeStorage: { getItem: () => null, setItem: jest.fn(), removeItem: jest.fn() },
}));
const DRAFT =
  '想找也想吃披薩的朋友一起討論餐點！照片中的活動是買一送一，實際品項、費用與使用條件請先確認。有興趣可以留言，一起協調取餐方式與分工，談妥細節後再決定是否參加。';
const props = { content: '', context: '', disabled: false, onApply: jest.fn() };
jest.setTimeout(20_000);
beforeEach(() => {
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
});
afterEach(() => {
  jest.resetAllMocks();
  jest.restoreAllMocks();
  mockActor = 'self';
});

it('offers exactly the two new actions and enables image recognition only with a selected photo', async () => {
  const screen = await render(<PostWritingAssistant {...props} />);
  expect(screen.getByRole('button', { name: '圖片辨識生成文案' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '語音潤稿' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'AI 生成貼文' })).toBeNull();
  expect(socialApi.writePost).not.toHaveBeenCalled();
});

it('shows the current queue position and aborts the pending job when the screen closes', async () => {
  jest
    .mocked(socialApi.writePost)
    .mockImplementation(async (_mode, _text, _context, _image, options) => {
      options?.onProgress?.({ status: 'queued', queue_position: 4 });
      return new Promise(() => undefined);
    });
  const screen = await render(<PostWritingAssistant {...props} imageBase64="photo" />);
  await fireEvent.press(screen.getByRole('button', { name: '圖片辨識生成文案' }));
  await waitFor(() => expect(screen.getByText(/AI 排隊中，目前第 4 位/)).toBeTruthy());
  const signal = jest.mocked(socialApi.writePost).mock.calls[0][4]?.signal;
  expect(signal?.aborted).toBe(false);
  await screen.unmount();
  expect(signal?.aborted).toBe(true);
});
it('recognizes a photo without requiring typed content and waits for explicit adoption', async () => {
  jest
    .mocked(socialApi.writePost)
    .mockResolvedValue({ text: DRAFT, source_text: '披薩買一送一，限外帶' });
  const onApply = jest.fn();
  const screen = await render(
    <PostWritingAssistant {...props} imageBase64="photo" onApply={onApply} />,
  );
  await fireEvent.press(screen.getByRole('button', { name: '圖片辨識生成文案' }));
  await waitFor(() => expect(screen.getByLabelText('AI 貼文草稿').props.value).toBe(DRAFT));
  expect(socialApi.writePost).toHaveBeenCalledWith('image', '', '', 'photo', expect.any(Object));
  expect(screen.getByText('披薩買一送一，限外帶')).toBeTruthy();
  expect(onApply).not.toHaveBeenCalled();
  await fireEvent.changeText(screen.getByLabelText('AI 貼文草稿'), '太短');
  expect(screen.getByRole('button', { name: '採用草稿' })).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('AI 貼文草稿'), DRAFT);
  await fireEvent.press(screen.getByRole('button', { name: '採用草稿' }));
  expect(onApply).toHaveBeenCalledWith(DRAFT);
});
it('discards late image results after the selected photo changes', async () => {
  let resolve!: (value: { text: string }) => void;
  jest.mocked(socialApi.writePost).mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const screen = await render(<PostWritingAssistant {...props} imageBase64="before" />);
  await fireEvent.press(screen.getByRole('button', { name: '圖片辨識生成文案' }));
  await screen.rerender(<PostWritingAssistant {...props} imageBase64="after" />);
  await act(async () => resolve({ text: DRAFT }));
  expect(screen.queryByLabelText('AI 貼文草稿')).toBeNull();
  expect(screen.getByText('照片或表單已變更，請重新生成。')).toBeTruthy();
});
it('hides an already generated preview when source content changes', async () => {
  jest.mocked(socialApi.writePost).mockResolvedValue({ text: DRAFT });
  const screen = await render(<PostWritingAssistant {...props} imageBase64="photo" />);
  await fireEvent.press(screen.getByRole('button', { name: '圖片辨識生成文案' }));
  await waitFor(() => expect(screen.getByLabelText('AI 貼文草稿')).toBeTruthy());
  await screen.rerender(<PostWritingAssistant {...props} content="新內容" imageBase64="photo" />);
  expect(screen.queryByLabelText('AI 貼文草稿')).toBeNull();
});
it('automatically polishes the speech transcript after recording ends', async () => {
  let events!: SpeechCallbacks;
  const stop = jest.fn();
  const cancel = jest.fn();
  jest.mocked(startPostSpeech).mockImplementation(async (callbacks) => {
    events = callbacks;
    return { stop, cancel };
  });
  jest.mocked(socialApi.writePost).mockResolvedValue({ text: DRAFT });
  const screen = await render(<PostWritingAssistant {...props} />);
  await fireEvent.press(screen.getByRole('button', { name: '語音潤稿' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '結束說話並潤稿' })).toBeTruthy());
  await act(async () => events.onText('想揪朋友一起買披薩'));
  expect(screen.getByLabelText('語音辨識文字').props.value).toBe('想揪朋友一起買披薩');
  expect(socialApi.writePost).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: '結束說話並潤稿' }));
  expect(stop).toHaveBeenCalledTimes(1);
  await act(async () => events.onEnd('想揪朋友一起買披薩'));
  await waitFor(() => expect(screen.getByLabelText('AI 貼文草稿').props.value).toBe(DRAFT));
  expect(socialApi.writePost).toHaveBeenCalledWith(
    'voice',
    '想揪朋友一起買披薩',
    '',
    undefined,
    expect.any(Object),
  );
});

it('shows the original-voice fallback as an editable preview and only applies it after confirmation', async () => {
  let events!: SpeechCallbacks;
  const source = '我想要吃一堆麥當勞薯條 有人要一起吃嗎';
  const draft = `${source}。想找有相同需求的朋友一起討論，有興趣可以留言或私訊，一起確認餐點內容與安排，再決定是否參加。`;
  const onApply = jest.fn();
  jest.mocked(startPostSpeech).mockImplementation(async (callbacks) => {
    events = callbacks;
    return { stop: jest.fn(), cancel: jest.fn() };
  });
  jest
    .mocked(socialApi.writePost)
    .mockResolvedValue({ text: draft, source_text: source, draft_method: 'spoken_facts' });
  const screen = await render(<PostWritingAssistant {...props} onApply={onApply} />);
  await fireEvent.press(screen.getByRole('button', { name: '語音潤稿' }));
  await act(async () => events.onEnd(source));
  expect(screen.getByText('已依你的口述原文整理成草稿，請核對後編輯採用。')).toBeTruthy();
  expect(screen.getByLabelText('AI 貼文草稿').props.value).toBe(draft);
  expect(onApply).not.toHaveBeenCalled();
  const edited = draft + '可以先討論。';
  await fireEvent.changeText(screen.getByLabelText('AI 貼文草稿'), edited);
  await fireEvent.press(screen.getByRole('button', { name: '採用草稿' }));
  expect(onApply).toHaveBeenCalledWith(edited);
});
it('cancels speech and ignores subsequent recognition callbacks', async () => {
  let events!: SpeechCallbacks;
  const cancel = jest.fn();
  jest.mocked(startPostSpeech).mockImplementation(async (callbacks) => {
    events = callbacks;
    return { stop: jest.fn(), cancel };
  });
  const screen = await render(<PostWritingAssistant {...props} />);
  await fireEvent.press(screen.getByRole('button', { name: '語音潤稿' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '結束說話並潤稿' })).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: '取消並返回' }));
  await act(async () => events.onEnd('取消後的舊內容'));
  expect(cancel).toHaveBeenCalled();
  expect(socialApi.writePost).not.toHaveBeenCalled();
});
it('keeps recognized speech editable if the model is unavailable', async () => {
  let events!: SpeechCallbacks;
  jest.mocked(startPostSpeech).mockImplementation(async (callbacks) => {
    events = callbacks;
    return { stop: jest.fn(), cancel: jest.fn() };
  });
  jest.mocked(socialApi.writePost).mockRejectedValue(new Error('offline'));
  const screen = await render(<PostWritingAssistant {...props} />);
  await fireEvent.press(screen.getByRole('button', { name: '語音潤稿' }));
  await act(async () => events.onEnd('披薩買一送一，想找人一起買'));
  await waitFor(() => expect(screen.getByText('暫時失敗')).toBeTruthy());
  expect(screen.getByLabelText('語音辨識文字').props.value).toContain('披薩');
  expect(screen.getByLabelText('語音辨識文字').props.editable).toBe(true);
  expect(screen.getByRole('button', { name: '用這段文字潤稿' })).toBeEnabled();
});
it('ignores an old account response and rejects model drafts shorter than 50 characters', async () => {
  let resolve!: (value: { text: string }) => void;
  jest.mocked(socialApi.writePost).mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const screen = await render(<PostWritingAssistant {...props} imageBase64="photo" />);
  await fireEvent.press(screen.getByRole('button', { name: '圖片辨識生成文案' }));
  mockActor = 'other';
  await act(async () => resolve({ text: DRAFT }));
  expect(screen.queryByLabelText('AI 貼文草稿')).toBeNull();
  await screen.unmount();
  mockActor = 'self';
  jest.mocked(socialApi.writePost).mockResolvedValue({ text: '過短的草稿' });
  const next = await render(<PostWritingAssistant {...props} imageBase64="photo" />);
  await fireEvent.press(next.getByRole('button', { name: '圖片辨識生成文案' }));
  await waitFor(() => expect(next.getByText('暫時失敗')).toBeTruthy());
  expect(next.queryByLabelText('AI 貼文草稿')).toBeNull();
});

it('uses the entire selected album with no typed content and shows the triggering button spinner', async () => {
  let resolve!: (value: { text: string }) => void;
  jest.mocked(socialApi.writePost).mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const screen = await render(
    <PostWritingAssistant {...props} imageBase64s={['first-photo', 'second-photo']} />,
  );
  await fireEvent.press(screen.getByRole('button', { name: '圖片辨識生成文案' }));
  expect(socialApi.writePost).toHaveBeenCalledWith(
    'image',
    '',
    '',
    ['first-photo', 'second-photo'],
    expect.any(Object),
  );
  expect(screen.getByLabelText('AI 正在辨識照片')).toBeTruthy();
  expect(
    screen.getByRole('button', { name: '圖片辨識生成文案' }).props.accessibilityState.busy,
  ).toBe(true);
  await act(async () => resolve({ text: DRAFT }));
  await waitFor(() => expect(screen.queryByLabelText('AI 正在辨識照片')).toBeNull());
  expect(screen.getByLabelText('AI 貼文草稿').props.value).toBe(DRAFT);
});
