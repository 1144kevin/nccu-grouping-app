import { afterAll, afterEach, expect, it, jest } from '@jest/globals';
import { TextDecoder, TextEncoder } from 'node:util';
import { Buffer } from 'node:buffer';
import { consumeSpeechStream, createStreamingReplyVoice } from './streaming-reply-voice.web';
import { stealthApi } from './stealth-api';
jest.mock('./stealth-api', () => ({ stealthApi: { speechStream: jest.fn() } }));
const oldDecoder = Object.getOwnPropertyDescriptor(globalThis, 'TextDecoder');
const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const oldAtob = Object.getOwnPropertyDescriptor(globalThis, 'atob');
Object.defineProperty(globalThis, 'atob', {
  value: (text: string) => Buffer.from(text, 'base64').toString('binary'),
  configurable: true,
});
Object.defineProperty(globalThis, 'TextDecoder', { value: TextDecoder, configurable: true });
const bytes = (value: unknown) => new TextEncoder().encode(`data: ${JSON.stringify(value)}\n\n`);
function fakeStream(parts: Uint8Array[]) {
  return {
    getReader: () => ({
      read: async () => (parts.length ? { done: false, value: parts.shift() } : { done: true }),
      cancel: async () => undefined,
      releaseLock: () => undefined,
    }),
  } as unknown as ReadableStream<Uint8Array>;
}
afterEach(() => {
  if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow);
  else delete (globalThis as { window?: unknown }).window;
  jest.clearAllMocks();
});
afterAll(() => {
  if (oldAtob) Object.defineProperty(globalThis, 'atob', oldAtob);
  else delete (globalThis as { atob?: unknown }).atob;
  if (oldDecoder) Object.defineProperty(globalThis, 'TextDecoder', oldDecoder);
  else delete (globalThis as { TextDecoder?: unknown }).TextDecoder;
});
it('delivers the first audio chunk before the stream completes', async () => {
  let finish!: (value: unknown) => void;
  let index = 0;
  const stream = {
    getReader: () => ({
      read: () =>
        ++index === 1
          ? Promise.resolve({
              done: false,
              value: bytes({ type: 'audio', data: 'AAAAAA==', sample_rate: 24000 }),
            })
          : index === 2
            ? new Promise((resolve) => {
                finish = resolve;
              })
            : Promise.resolve({ done: true }),
      cancel: async () => undefined,
      releaseLock: () => undefined,
    }),
  } as unknown as ReadableStream<Uint8Array>;
  const chunk = jest.fn();
  const reading = consumeSpeechStream(stream, chunk);
  await Promise.resolve();
  await Promise.resolve();
  expect(chunk).toHaveBeenCalledWith('AAAAAA==', 24000);
  finish({ done: false, value: bytes({ type: 'done' }) });
  await reading;
});
it('rejects incomplete audio rather than treating a cut connection as successful', async () => {
  await expect(
    consumeSpeechStream(
      fakeStream([bytes({ type: 'audio', data: 'AAAAAA==', sample_rate: 24000 })]),
      jest.fn(),
    ),
  ).rejects.toThrow('incomplete audio');
});
it('activates audio synchronously when the user submits a message', () => {
  const start = jest.fn();
  const resume = jest.fn(async () => undefined);
  class Context {
    destination = {};
    resume = resume;
    close = async () => undefined;
    createBuffer() { return {}; }
    createBufferSource() { return { buffer: null, connect: jest.fn(), start }; }
  }
  Object.defineProperty(globalThis, 'window', { value: { AudioContext: Context }, configurable: true });
  const voice = createStreamingReplyVoice()!;
  voice.unlock?.();
  expect(resume).toHaveBeenCalledTimes(1);
  expect(start).toHaveBeenCalledTimes(1);
  voice.dispose?.();
});
it('schedules PCM playback and stops all queued audio on cancel', async () => {
  const sources: {
    stop: ReturnType<typeof jest.fn>;
    start: ReturnType<typeof jest.fn>;
    disconnect: ReturnType<typeof jest.fn>;
  }[] = [];
  class Context {
    currentTime = 0;
    destination = {};
    resume = async () => undefined;
    close = async () => undefined;
    createBuffer(_channels: number, length: number, rate: number) {
      return { duration: length / rate, getChannelData: () => new Float32Array(length) };
    }
    createBufferSource() {
      const source = {
        stop: jest.fn(),
        start: jest.fn(),
        disconnect: jest.fn(),
        connect: jest.fn(),
        onended: null,
      };
      sources.push(source);
      return source;
    }
  }
  Object.defineProperty(globalThis, 'window', {
    value: { AudioContext: Context },
    configurable: true,
  });
  jest
    .mocked(stealthApi.speechStream)
    .mockResolvedValue(
      fakeStream([
        bytes({ type: 'audio', data: 'AAAAAA==', sample_rate: 24000 }),
        bytes({ type: 'done' }),
      ]),
    );
  const voice = createStreamingReplyVoice()!;
  const state = jest.fn();
  const preparing = jest.fn();
  const error = jest.fn();
  voice.speak('測試', state, error, preparing);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(sources).toHaveLength(1);
  expect(sources[0].start).toHaveBeenCalled();
  expect(preparing).toHaveBeenLastCalledWith(false);
  voice.stop();
  expect(sources[0].stop).toHaveBeenCalled();
  expect(state).toHaveBeenLastCalledWith(false);
  expect(error).not.toHaveBeenCalled();
  voice.dispose?.();
});
