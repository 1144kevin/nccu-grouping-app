import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { startPostSpeech } from './post-speech.web';

class FakeRecognition {
  lang = '';
  continuous = false;
  interimResults = false;
  onresult: ((event: { results: { transcript: string }[][] }) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start = jest.fn();
  stop = jest.fn();
  abort = jest.fn();
  constructor() {
    instance = this;
  }
}
let instance: FakeRecognition;
const host = globalThis as typeof globalThis & { SpeechRecognition?: typeof FakeRecognition };
beforeEach(() => {
  jest.useFakeTimers();
  host.SpeechRecognition = FakeRecognition;
});
afterEach(() => {
  delete host.SpeechRecognition;
  jest.useRealTimers();
});
const callbacks = () => ({ onText: jest.fn(), onEnd: jest.fn(), onError: jest.fn() });
it('accumulates browser transcripts and ends only after recognition finishes', async () => {
  const events = callbacks();
  const session = await startPostSpeech(events);
  expect(instance.lang).toBe('zh-TW');
  instance.onresult?.({ results: [[{ transcript: '披薩' }], [{ transcript: '買一送一' }]] });
  expect(events.onText).toHaveBeenCalledWith('披薩買一送一');
  session.stop();
  expect(events.onEnd).not.toHaveBeenCalled();
  instance.onend?.();
  expect(events.onEnd).toHaveBeenCalledWith('披薩買一送一');
  expect(instance.onresult).toBeNull();
});
it('cancels without sending partial speech for polishing', async () => {
  const events = callbacks();
  const abort = new AbortController();
  await startPostSpeech(events, abort.signal);
  const late = instance.onresult;
  abort.abort();
  late?.({ results: [[{ transcript: '舊語音' }]] });
  jest.runAllTimers();
  expect(instance.abort).toHaveBeenCalled();
  expect(events.onText).not.toHaveBeenCalled();
  expect(events.onEnd).not.toHaveBeenCalled();
});
it('limits speech to 60 seconds and returns the transcript even if the browser omits end', async () => {
  const events = callbacks();
  await startPostSpeech(events);
  instance.onresult?.({ results: [[{ transcript: '想喝飲料' }]] });
  jest.advanceTimersByTime(60_000);
  expect(instance.stop).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(5000);
  expect(events.onEnd).toHaveBeenCalledWith('想喝飲料');
});
it('reports denied permissions and cleans up callbacks', async () => {
  const events = callbacks();
  await startPostSpeech(events);
  instance.onerror?.({ error: 'not-allowed' });
  expect(events.onError).toHaveBeenCalledWith('post_speech_permission_denied');
  expect(instance.onend).toBeNull();
  expect(events.onEnd).not.toHaveBeenCalled();
});
it('does not start a cancelled session or pretend an unsupported browser can record', async () => {
  const abort = new AbortController();
  abort.abort();
  await expect(startPostSpeech(callbacks(), abort.signal)).rejects.toThrow('post_speech_cancelled');
  delete host.SpeechRecognition;
  await expect(startPostSpeech(callbacks())).rejects.toThrow('post_speech_unavailable');
});
