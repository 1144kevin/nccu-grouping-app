import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { createReplyVoice } from './reply-voice.web';

class Utterance {
  lang = '';
  rate = 1;
  voice: SpeechSynthesisVoice | null = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public text: string) {}
}
let spoken: Utterance;
const taiwan = { lang: 'zh-TW', name: '台灣中文' } as SpeechSynthesisVoice;
const synth = {
  getVoices: jest.fn(() => [{ lang: 'en-US' } as SpeechSynthesisVoice, taiwan]),
  speak: jest.fn((utterance: Utterance) => {
    spoken = utterance;
  }),
  cancel: jest.fn(),
};
const oldSynth = Object.getOwnPropertyDescriptor(globalThis, 'speechSynthesis');
const oldUtterance = Object.getOwnPropertyDescriptor(globalThis, 'SpeechSynthesisUtterance');
beforeEach(() => {
  jest.useFakeTimers();
  Object.defineProperty(globalThis, 'speechSynthesis', { value: synth, configurable: true });
  Object.defineProperty(globalThis, 'SpeechSynthesisUtterance', {
    value: Utterance,
    configurable: true,
  });
});
afterEach(() => {
  if (oldSynth) Object.defineProperty(globalThis, 'speechSynthesis', oldSynth);
  else Reflect.deleteProperty(globalThis, 'speechSynthesis');
  if (oldUtterance) Object.defineProperty(globalThis, 'SpeechSynthesisUtterance', oldUtterance);
  else Reflect.deleteProperty(globalThis, 'SpeechSynthesisUtterance');
  jest.clearAllMocks();
  jest.useRealTimers();
});

it('prefers Taiwan Mandarin and stops without leaving late playback callbacks active', () => {
  const voice = createReplyVoice()!;
  const state = jest.fn(),
    error = jest.fn();
  voice.speak('想喝飲料，在哪裡方便？', state, error);
  expect(spoken.lang).toBe('zh-TW');
  expect(spoken.voice).toBe(taiwan);
  const lateEnd = spoken.onend;
  spoken.onstart?.();
  voice.stop();
  lateEnd?.();
  jest.runAllTimers();
  expect(synth.cancel).toHaveBeenCalledTimes(1);
  expect(state).toHaveBeenLastCalledWith(false);
  expect(error).not.toHaveBeenCalled();
});
it('reports a browser autoplay failure without blocking the text reply', () => {
  const voice = createReplyVoice()!;
  const state = jest.fn(),
    error = jest.fn();
  voice.speak('可以先確認需求', state, error);
  jest.advanceTimersByTime(10_000);
  expect(error).toHaveBeenCalledTimes(1);
  expect(state).toHaveBeenLastCalledWith(false);
});
it('does not enqueue an old reply when replay is pressed again', () => {
  const voice = createReplyVoice()!;
  voice.speak('舊回覆', jest.fn(), jest.fn());
  const lateEnd = spoken.onend;
  const state = jest.fn();
  voice.speak('新回覆', state, jest.fn());
  lateEnd?.();
  expect(spoken.text).toBe('新回覆');
  expect(state).toHaveBeenLastCalledWith(true);
  voice.stop();
});
it('returns no adapter when speech synthesis is unavailable', () => {
  Reflect.deleteProperty(globalThis, 'speechSynthesis');
  expect(createReplyVoice()).toBeNull();
});
