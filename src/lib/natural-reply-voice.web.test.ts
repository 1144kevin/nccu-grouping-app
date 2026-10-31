import { afterEach, expect, it, jest } from '@jest/globals';
import { createNaturalReplyVoice } from './natural-reply-voice.web';
import { stealthApi } from './stealth-api';
jest.mock('./stealth-api', () => ({ stealthApi: { speech: jest.fn() } }));
const originalAudio = Object.getOwnPropertyDescriptor(globalThis, 'Audio');
let audio: FakeAudio;
class FakeAudio {
  src = '';
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  play = jest.fn(async () => undefined);
  pause = jest.fn();
  removeAttribute() {
    this.src = '';
  }
  constructor() {
    audio = this;
  }
}
afterEach(() => {
  if (originalAudio) Object.defineProperty(globalThis, 'Audio', originalAudio);
  else delete (globalThis as { Audio?: unknown }).Audio;
  jest.resetAllMocks();
});
it('loads natural speech, permits replay, and releases audio when stopped', async () => {
  Object.defineProperty(globalThis, 'Audio', { value: FakeAudio, configurable: true });
  jest
    .mocked(stealthApi.speech)
    .mockResolvedValue({ mime_type: 'audio/wav', audio_base64: 'wave-data' });
  const voice = createNaturalReplyVoice()!;
  const state = jest.fn();
  const error = jest.fn();
  voice.speak('一起喝飲料嗎？', state, error);
  await Promise.resolve();
  await Promise.resolve();
  expect(stealthApi.speech).toHaveBeenCalledWith('一起喝飲料嗎？', expect.any(AbortSignal));
  expect(audio.src).toBe('data:audio/wav;base64,wave-data');
  expect(error).not.toHaveBeenCalled();
  voice.stop();
  expect(audio.src).toBe('');
  expect(state).toHaveBeenLastCalledWith(false);
});
it('never plays a late response after cancellation or a new speaker session', async () => {
  Object.defineProperty(globalThis, 'Audio', { value: FakeAudio, configurable: true });
  let resolve!: (value: { mime_type: 'audio/wav'; audio_base64: string }) => void;
  jest.mocked(stealthApi.speech).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const voice = createNaturalReplyVoice()!;
  voice.speak('舊回覆', jest.fn(), jest.fn());
  voice.stop();
  resolve({ mime_type: 'audio/wav', audio_base64: 'stale' });
  await Promise.resolve();
  await Promise.resolve();
  expect(audio.src).toBe('');
});
