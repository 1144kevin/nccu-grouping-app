import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { QuickStealthComposer } from './quick-stealth-composer';
import { stealthApi, type StealthConversation } from '@/lib/stealth-api';
import { startPostSpeech } from '@/lib/post-speech';
import { createReplyVoice } from '@/lib/reply-voice';
import { useStealthPreferencesStore } from '@/store/stealth-preferences-store';
import type { SpeechCallbacks } from '@/lib/post-speech.types';
let mockActor = 'self';
let mockKey = 0;
jest.mock('@/store/auth-store', () => ({
  useAuthStore: { getState: () => ({ user: { id: mockActor } }) },
}));
jest.mock('@/lib/stealth-api', () => ({
  stealthApi: { quickStart: jest.fn(), conversation: jest.fn() },
}));
jest.mock('@/lib/post-speech', () => ({ startPostSpeech: jest.fn() }));
jest.mock('@/lib/reply-voice', () => ({ createReplyVoice: jest.fn() }));
jest.mock('@/lib/core-api', () => ({
  coreError: () => '連線失敗',
  newRequestKey: () => `key-${++mockKey}`,
}));
jest.mock('@/lib/font-size-storage', () => ({
  fontSizeStorage: { getItem: () => null, setItem: jest.fn(), removeItem: jest.fn() },
}));
const draft = {
  facts: {
    title: '想喝50嵐',
    kind: 'need',
    category: 'drink',
    location_id: null,
    delay_minutes: null,
    duration_minutes: null,
    roles: [],
    roles_confirmed: false,
    budget_max_twd: null,
    budget_unknown: false,
  },
  signal: {
    title: '想喝50嵐',
    kind: 'need',
    category: 'drink',
    location_id: 'main_gate',
    starts_at: '2026-10-29T10:00:00Z',
    ends_at: '2026-10-29T12:00:00Z',
    expires_at: '2026-10-29T12:00:00Z',
    roles: [],
    budget_max_twd: null,
    known_cost_twd: null,
    tags: ['品牌:50嵐'],
    dietary_requirements: [],
    dietary_verified: [],
    acceptable_categories: [],
  },
  sources: [],
  message: '在哪裡碰面比較方便？',
  question: { field: 'location_id', text: '在哪裡碰面比較方便？' },
  choices: [{ label: '東側門', answer: '取餐地點在政大東側門' }],
  ready_for_review: false,
  interpretation: 'local_model',
} as unknown as StealthConversation;
const props = {
  actor: 'self',
  enabled: false,
  disabled: false,
  focused: true,
  onSaved: jest.fn<() => Promise<void>>(),
  onBusyChange: jest.fn(),
};
beforeEach(() => {
  useStealthPreferencesStore.setState({ accounts: {} });
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  jest.mocked(stealthApi.conversation).mockResolvedValue(draft);
  jest.mocked(stealthApi.quickStart).mockResolvedValue({
    created: { signal: draft.signal, matching: 'completed' },
    sources: [],
    interpretation: 'reviewed',
  } as never);
  props.onSaved.mockResolvedValue(undefined);
});
it('sends only this account’s saved preferences alongside the actual conversation', async () => {
  useStealthPreferencesStore.getState().save('other', { tone: 'playful', context: '別人的偏好' });
  useStealthPreferencesStore.getState().save('self', { tone: 'direct', context: '常在東側門' });
  await startChat();
  expect(stealthApi.conversation).toHaveBeenCalledWith(
    ['想喝50嵐'],
    undefined,
    [null],
    expect.any(AbortSignal),
    [],
    { tone: 'direct', context: '常在東側門' },
  );
});
afterEach(() => {
  jest.resetAllMocks();
  jest.restoreAllMocks();
  mockActor = 'self';
});
async function startChat() {
  const screen = await render(<QuickStealthComposer {...props} />);
  await fireEvent.changeText(screen.getByLabelText('跟偷揪分身聊天'), '想喝50嵐');
  await fireEvent.press(screen.getByRole('button', { name: '傳送給分身' }));
  await waitFor(() => expect(screen.getByText(draft.message)).toBeTruthy());
  return screen;
}
async function reviewDraft(screen: Awaited<ReturnType<typeof startChat>>) {
  await fireEvent.press(screen.getByRole('button', { name: '先確認目前需求' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '確認條件，開始找人' })).toBeEnabled(),
  );
}
it('greets immediately, asks one question and only creates a request after explicit review', async () => {
  const screen = await render(<QuickStealthComposer {...props} />);
  expect(screen.getByText(/今天有什麼想跟我分享/)).toBeTruthy();
  expect(stealthApi.conversation).not.toHaveBeenCalled();
  expect(stealthApi.quickStart).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: '想喝飲料' }));
  await waitFor(() => expect(screen.getByText(draft.message)).toBeTruthy());
  expect(stealthApi.conversation).toHaveBeenCalledWith(
    ['我想找人一起喝飲料'],
    undefined,
    [null],
    expect.any(AbortSignal),
    [],
    undefined,
  );
  expect(screen.queryByRole('button', { name: '確認條件，開始找人' })).toBeNull();
  await reviewDraft(screen);
  expect(screen.getByText('建議：政大正門')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: '確認條件，開始找人' }));
  await waitFor(() => expect(props.onSaved).toHaveBeenCalledTimes(1));
  expect(stealthApi.quickStart).toHaveBeenCalledWith(
    draft.signal!.title,
    true,
    expect.any(String),
    draft.signal,
  );
});
it('carries question context and all previous facts with a shortcut or free correction', async () => {
  const screen = await startChat();
  const changed = {
    ...draft,
    signal: { ...draft.signal!, location_id: 'east_gate' },
    message: '想從什麼時候開始？',
    question: { field: 'delay_minutes', text: '想從什麼時候開始？' },
  } as StealthConversation;
  jest.mocked(stealthApi.conversation).mockResolvedValue(changed);
  await fireEvent.press(screen.getByRole('button', { name: '東側門' }));
  await waitFor(() => expect(screen.getByText(changed.message)).toBeTruthy());
  expect(stealthApi.conversation).toHaveBeenLastCalledWith(
    ['想喝50嵐', '取餐地點在政大東側門'],
    draft.facts,
    [null, 'location_id'],
    expect.any(AbortSignal),
    [draft.message],
    undefined,
  );
  await fireEvent.changeText(screen.getByLabelText('跟偷揪分身聊天'), '預算改成120元');
  expect(screen.getByRole('button', { name: '先確認目前需求' })).toBeDisabled();
  expect(stealthApi.quickStart).not.toHaveBeenCalled();
});
it('retains failed answers and blocks saving a preview that has an unprocessed correction', async () => {
  const screen = await startChat();
  jest.mocked(stealthApi.conversation).mockRejectedValue(new Error('offline'));
  await fireEvent.changeText(screen.getByLabelText('跟偷揪分身聊天'), '改成南門');
  await fireEvent.press(screen.getByRole('button', { name: '傳送給分身' }));
  await waitFor(() => expect(screen.getByText(/這次補充已保留/)).toBeTruthy());
  expect(screen.getByLabelText('跟偷揪分身聊天').props.value).toBe('改成南門');
  expect(screen.getByRole('button', { name: '先確認目前需求' })).toBeDisabled();
  expect(stealthApi.quickStart).not.toHaveBeenCalled();
});
it('retries saving the exact reviewed timestamps and request key without regenerating', async () => {
  const screen = await startChat();
  await reviewDraft(screen);
  jest.mocked(stealthApi.quickStart).mockRejectedValueOnce(new Error('offline'));
  await fireEvent.press(screen.getByRole('button', { name: '確認條件，開始找人' }));
  await waitFor(() => expect(screen.getByText(/已確認的條件仍保留/)).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: '確認條件，開始找人' }));
  await waitFor(() => expect(stealthApi.quickStart).toHaveBeenCalledTimes(2));
  expect(jest.mocked(stealthApi.quickStart).mock.calls[1]).toEqual(
    jest.mocked(stealthApi.quickStart).mock.calls[0],
  );
  expect(stealthApi.conversation).toHaveBeenCalledTimes(1);
});
it('previews speech, lets the user correct it and sends only the confirmed text', async () => {
  let events!: SpeechCallbacks;
  const stop = jest.fn(() => events.onEnd('我有披薩優惠券'));
  jest.mocked(startPostSpeech).mockImplementation(async (callbacks) => {
    events = callbacks;
    return { stop, cancel: jest.fn() };
  });
  const screen = await render(<QuickStealthComposer {...props} />);
  await fireEvent.press(screen.getByRole('button', { name: '用語音回答' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '結束錄音' })).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: '結束錄音' }));
  await waitFor(() => expect(screen.getByText('確認語音文字')).toBeTruthy());
  expect(stealthApi.conversation).not.toHaveBeenCalled();
  expect(screen.getByLabelText('跟偷揪分身聊天').props.value).toBe('我有披薩優惠券');
  await fireEvent.changeText(screen.getByLabelText('跟偷揪分身聊天'), '我有飲料優惠券');
  await fireEvent.press(screen.getByRole('button', { name: '確認文字並送出' }));
  await waitFor(() =>
    expect(stealthApi.conversation).toHaveBeenCalledWith(
      ['我有飲料優惠券'],
      undefined,
      [null],
      expect.any(AbortSignal),
      [],
      undefined,
    ),
  );
  expect(stealthApi.quickStart).not.toHaveBeenCalled();
});
it('cancels capture and ignores callbacks after focus is lost', async () => {
  let events!: SpeechCallbacks;
  const cancel = jest.fn();
  jest.mocked(startPostSpeech).mockImplementation(async (callbacks) => {
    events = callbacks;
    return { stop: jest.fn(), cancel };
  });
  const screen = await render(<QuickStealthComposer {...props} />);
  await fireEvent.press(screen.getByRole('button', { name: '用語音回答' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '結束錄音' })).toBeTruthy());
  await screen.rerender(<QuickStealthComposer {...props} focused={false} />);
  await act(async () => events.onEnd('過期的語音'));
  expect(cancel).toHaveBeenCalled();
  expect(stealthApi.conversation).not.toHaveBeenCalled();
});
it('aborts pending understanding on exit and ignores a result from a previous account', async () => {
  let resolve!: (value: StealthConversation) => void;
  jest.mocked(stealthApi.conversation).mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const screen = await render(<QuickStealthComposer {...props} />);
  await fireEvent.changeText(screen.getByLabelText('跟偷揪分身聊天'), '想喝50嵐');
  await fireEvent.press(screen.getByRole('button', { name: '傳送給分身' }));
  const signal = jest.mocked(stealthApi.conversation).mock.calls[0][3];
  mockActor = 'other';
  await screen.rerender(<QuickStealthComposer {...props} focused={false} />);
  expect(signal?.aborted).toBe(true);
  await act(async () => resolve(draft));
  expect(screen.queryByText(draft.message)).toBeNull();
  expect(stealthApi.quickStart).not.toHaveBeenCalled();
});

it('keeps partial speech editable after an error and blocks an empty confirmation', async () => {
  let events!: SpeechCallbacks;
  jest.mocked(startPostSpeech).mockImplementation(async (callbacks) => {
    events = callbacks;
    return { stop: jest.fn(), cancel: jest.fn() };
  });
  const screen = await render(<QuickStealthComposer {...props} />);
  await fireEvent.press(screen.getByRole('button', { name: '用語音回答' }));
  await act(async () => {
    events.onText('晚餐想吃披薩');
    events.onError('post_speech_network');
  });
  expect(stealthApi.conversation).not.toHaveBeenCalled();
  expect(screen.getByLabelText('跟偷揪分身聊天').props.value).toBe('晚餐想吃披薩');
  await fireEvent.changeText(screen.getByLabelText('跟偷揪分身聊天'), '');
  expect(screen.getByRole('button', { name: '確認文字並送出' })).toBeDisabled();
});

it('reads replies only after opt-in and stops playback before microphone capture', async () => {
  const voice = { speak: jest.fn(), stop: jest.fn() };
  jest.mocked(createReplyVoice).mockReturnValue(voice);
  jest.mocked(startPostSpeech).mockResolvedValue({ stop: jest.fn(), cancel: jest.fn() });
  const screen = await render(<QuickStealthComposer {...props} />);
  expect(voice.speak).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: '開啟語音回覆' }));
  expect(voice.speak).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole('button', { name: '想喝飲料' }));
  await waitFor(() =>
    expect(voice.speak).toHaveBeenLastCalledWith(
      draft.message,
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
    ),
  );
  voice.stop.mockClear();
  await fireEvent.press(screen.getByRole('button', { name: '用語音回答' }));
  expect(voice.stop).toHaveBeenCalled();
  expect(voice.stop.mock.invocationCallOrder[0]).toBeLessThan(
    jest.mocked(startPostSpeech).mock.invocationCallOrder[0],
  );
  await screen.rerender(<QuickStealthComposer {...props} focused={false} />);
  expect(voice.stop).toHaveBeenCalledTimes(2);
});
it('does not read an in-flight reply after voice has been switched off', async () => {
  const voice = { speak: jest.fn(), stop: jest.fn() };
  jest.mocked(createReplyVoice).mockReturnValue(voice);
  let resolve!: (value: StealthConversation) => void;
  jest.mocked(stealthApi.conversation).mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const screen = await render(<QuickStealthComposer {...props} />);
  await fireEvent.press(screen.getByRole('button', { name: '開啟語音回覆' }));
  await fireEvent.press(screen.getByRole('button', { name: '想喝飲料' }));
  await fireEvent.press(screen.getByRole('button', { name: '關閉語音回覆' }));
  await act(async () => resolve(draft));
  expect(voice.speak).toHaveBeenCalledTimes(1);
});
