import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { QuickStealthComposer } from './quick-stealth-composer';
import { stealthApi, type StealthQuickInterview } from '@/lib/stealth-api';
import { startPostSpeech } from '@/lib/post-speech';
import type { SpeechCallbacks } from '@/lib/post-speech.types';

let mockActor = 'self';
let mockKey = 0;
jest.mock('@/store/auth-store', () => ({
  useAuthStore: { getState: () => ({ user: { id: mockActor } }) },
}));
jest.mock('@/lib/stealth-api', () => ({
  stealthApi: { quickStart: jest.fn(), quickInterview: jest.fn() },
}));
jest.mock('@/lib/post-speech', () => ({ startPostSpeech: jest.fn() }));
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
    roles: [],
    budget_max_twd: null,
  },
  signal: {
    title: '想喝50嵐',
    kind: 'need',
    category: 'drink',
    location_id: 'main_gate',
    starts_at: '2026-10-24T10:00:00Z',
    ends_at: '2026-10-24T12:00:00Z',
    expires_at: '2026-10-24T12:00:00Z',
    roles: [],
    budget_max_twd: null,
    known_cost_twd: null,
    tags: ['品牌:50嵐'],
    dietary_requirements: [],
    dietary_verified: [],
    acceptable_categories: [],
  },
  sources: ['時間：暫找接下來兩小時'],
  questions: [{ field: 'budget_max_twd', text: '想補充預算嗎？' }],
  interpretation: 'local_model',
} as unknown as StealthQuickInterview;
const props = {
  actor: 'self',
  enabled: false,
  disabled: false,
  focused: true,
  onSaved: jest.fn<() => Promise<void>>(),
  onBusyChange: jest.fn(),
};
beforeEach(() => {
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  jest.mocked(stealthApi.quickInterview).mockResolvedValue(draft);
  jest
    .mocked(stealthApi.quickStart)
    .mockResolvedValue({
      created: { signal: { title: '想喝50嵐' }, matching: 'completed' },
      sources: [],
      interpretation: 'reviewed',
    } as never);
  props.onSaved.mockResolvedValue(undefined);
});
afterEach(() => {
  jest.resetAllMocks();
  jest.restoreAllMocks();
  mockActor = 'self';
});
async function startChat() {
  const screen = await render(<QuickStealthComposer {...props} />);
  await fireEvent.changeText(screen.getByLabelText('一句話告訴分身'), '想喝50嵐');
  await fireEvent.press(screen.getByRole('button', { name: '想講清楚，繼續聊聊（選填）' }));
  await waitFor(() => expect(screen.getByText('分身目前理解')).toBeTruthy());
  return screen;
}
it('allows skipping every optional interview field and saves only the reviewed signal', async () => {
  const screen = await startChat();
  expect(stealthApi.quickStart).not.toHaveBeenCalled();
  expect(screen.getByText('想補充預算嗎？')).toBeTruthy();
  const submit = screen.getByRole('button', { name: '啟用分身並用目前資訊幫我揪' });
  expect(submit).toBeEnabled();
  await fireEvent.press(submit);
  await waitFor(() =>
    expect(stealthApi.quickStart).toHaveBeenCalledWith(
      '想喝50嵐',
      true,
      expect.any(String),
      draft.signal,
    ),
  );
  expect(props.onSaved).toHaveBeenCalledTimes(1);
});
it('sends previous facts with a correction and never submits an unprocessed answer', async () => {
  const screen = await startChat();
  const changed = {
    ...draft,
    signal: { ...draft.signal!, location_id: 'east_gate', budget_max_twd: 120 },
  } as StealthQuickInterview;
  jest.mocked(stealthApi.quickInterview).mockResolvedValue(changed);
  await fireEvent.changeText(screen.getByLabelText('補充時間地點或預算'), '東側門，預算120');
  expect(screen.getByRole('button', { name: '啟用分身並用目前資訊幫我揪' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: '補充給分身' }));
  await waitFor(() =>
    expect(stealthApi.quickInterview).toHaveBeenLastCalledWith(
      ['想喝50嵐', '東側門，預算120'],
      draft.facts,
    ),
  );
  await waitFor(() => expect(screen.getByLabelText('補充時間地點或預算').props.value).toBe(''));
  await fireEvent.press(screen.getByRole('button', { name: '啟用分身並用目前資訊幫我揪' }));
  await waitFor(() =>
    expect(stealthApi.quickStart).toHaveBeenCalledWith(
      changed.signal!.title,
      true,
      expect.any(String),
      changed.signal,
    ),
  );
});
it('retains failed followups and blocks accepting an outdated preview until they are handled', async () => {
  const screen = await startChat();
  jest.mocked(stealthApi.quickInterview).mockRejectedValue(new Error('offline'));
  await fireEvent.changeText(screen.getByLabelText('補充時間地點或預算'), '改成南門');
  await fireEvent.press(screen.getByRole('button', { name: '補充給分身' }));
  await waitFor(() => expect(screen.getByText(/補充已保留/)).toBeTruthy());
  expect(screen.getByLabelText('補充時間地點或預算').props.value).toBe('改成南門');
  expect(screen.getByRole('button', { name: '啟用分身並用目前資訊幫我揪' })).toBeDisabled();
  expect(stealthApi.quickStart).not.toHaveBeenCalled();
});
it('preserves the exact reviewed timestamps and retry key after an uncertain save', async () => {
  const screen = await startChat();
  jest.mocked(stealthApi.quickStart).mockRejectedValueOnce(new Error('offline'));
  await fireEvent.press(screen.getByRole('button', { name: '啟用分身並用目前資訊幫我揪' }));
  await waitFor(() => expect(screen.getByText(/輸入已保留/)).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: '啟用分身並用目前資訊幫我揪' }));
  await waitFor(() => expect(stealthApi.quickStart).toHaveBeenCalledTimes(2));
  expect(jest.mocked(stealthApi.quickStart).mock.calls[1]).toEqual(
    jest.mocked(stealthApi.quickStart).mock.calls[0],
  );
});
it('speech can fill the one-sentence entry without implicitly enabling the agent', async () => {
  let events!: SpeechCallbacks;
  const stop = jest.fn();
  jest.mocked(startPostSpeech).mockImplementation(async (callbacks) => {
    events = callbacks;
    return { stop, cancel: jest.fn() };
  });
  const screen = await render(<QuickStealthComposer {...props} />);
  await fireEvent.press(screen.getByRole('button', { name: '用語音說一句' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '說好了，確認語音文字' })).toBeTruthy(),
  );
  await act(async () => events.onText('我有披薩優惠券'));
  await fireEvent.press(screen.getByRole('button', { name: '說好了，確認語音文字' }));
  expect(stop).toHaveBeenCalledTimes(1);
  await act(async () => events.onEnd('我有披薩優惠券'));
  expect(screen.getByLabelText('一句話告訴分身').props.value).toBe('我有披薩優惠券');
  expect(stealthApi.quickStart).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: '啟用分身並幫我揪' }));
  await waitFor(() =>
    expect(stealthApi.quickStart).toHaveBeenCalledWith('我有披薩優惠券', true, expect.any(String)),
  );
});
it('voice interview answers automatically update the draft without creating a signal', async () => {
  let events!: SpeechCallbacks;
  jest.mocked(startPostSpeech).mockImplementation(async (callbacks) => {
    events = callbacks;
    return { stop: jest.fn(), cancel: jest.fn() };
  });
  const screen = await startChat();
  await fireEvent.press(screen.getByRole('button', { name: '用語音回答' }));
  await act(async () => events.onEnd('東側門，半小時後，預算120'));
  await waitFor(() =>
    expect(stealthApi.quickInterview).toHaveBeenLastCalledWith(
      ['想喝50嵐', '東側門，半小時後，預算120'],
      draft.facts,
    ),
  );
  expect(stealthApi.quickStart).not.toHaveBeenCalled();
});
it('cancels capture and ignores voice or AI callbacks after losing focus', async () => {
  let events!: SpeechCallbacks;
  const cancel = jest.fn();
  jest.mocked(startPostSpeech).mockImplementation(async (callbacks) => {
    events = callbacks;
    return { stop: jest.fn(), cancel };
  });
  const screen = await render(<QuickStealthComposer {...props} />);
  await fireEvent.press(screen.getByRole('button', { name: '用語音說一句' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '說好了，確認語音文字' })).toBeTruthy(),
  );
  await screen.rerender(<QuickStealthComposer {...props} focused={false} />);
  await act(async () => events.onEnd('過期的語音'));
  expect(cancel).toHaveBeenCalled();
  expect(screen.getByLabelText('一句話告訴分身').props.value).toBe('');
  expect(stealthApi.quickInterview).not.toHaveBeenCalled();
});
it('ignores a late interview result if the account changes', async () => {
  let resolve!: (value: StealthQuickInterview) => void;
  jest.mocked(stealthApi.quickInterview).mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const screen = await render(<QuickStealthComposer {...props} />);
  await fireEvent.changeText(screen.getByLabelText('一句話告訴分身'), '想喝50嵐');
  await fireEvent.press(screen.getByRole('button', { name: '想講清楚，繼續聊聊（選填）' }));
  mockActor = 'other';
  await act(async () => resolve(draft));
  expect(screen.queryByText('分身目前理解')).toBeNull();
  expect(stealthApi.quickStart).not.toHaveBeenCalled();
});
