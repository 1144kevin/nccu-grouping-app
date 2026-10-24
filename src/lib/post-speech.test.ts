import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { startPostSpeech } from './post-speech';
import { requireOptionalNativeModule } from 'expo';

type Event = { id: string; text?: string; code?: string };
jest.mock('./app-runtime', () => ({ isExpoGo: () => false }));
jest.mock('expo', () => {
  const listeners = new Map();
  const native = {
    listeners,
    start: jest.fn(),
    stop: jest.fn(),
    cancel: jest.fn(),
    addListener: jest.fn((event, callback) => {
      listeners.set(event, callback);
      return { remove: jest.fn(() => listeners.delete(event)) };
    }),
  };
  return { requireOptionalNativeModule: () => native };
});
const mockNative = requireOptionalNativeModule('NCCUPostSpeech') as {
  start: ReturnType<typeof jest.fn<(id: string) => Promise<void>>>;
  stop: ReturnType<typeof jest.fn>;
  cancel: ReturnType<typeof jest.fn>;
  listeners: Map<string, (event: Event) => void>;
};
const mockListeners = mockNative.listeners;
const callbacks = () => ({ onText: jest.fn(), onEnd: jest.fn(), onError: jest.fn() });
beforeEach(() => {
  mockNative.start.mockResolvedValue(undefined);
});
afterEach(() => {
  jest.clearAllMocks();
  mockListeners.clear();
});
it('isolates native speech events by request and removes subscriptions on completion', async () => {
  const events = callbacks();
  const session = await startPostSpeech(events);
  const id = mockNative.start.mock.calls[0][0];
  mockListeners.get('text')?.({ id: 'old-request', text: '舊資料' });
  expect(events.onText).not.toHaveBeenCalled();
  mockListeners.get('text')?.({ id, text: '想吃披薩' });
  session.stop();
  expect(mockNative.stop).toHaveBeenCalledWith(id);
  mockListeners.get('end')?.({ id, text: '想吃披薩' });
  expect(events.onEnd).toHaveBeenCalledWith('想吃披薩');
  expect(mockListeners.size).toBe(0);
});
it('cancels a pending permission request immediately when the screen is closed', async () => {
  let resolve!: () => void;
  mockNative.start.mockReturnValueOnce(
    new Promise<void>((r) => {
      resolve = r;
    }),
  );
  const abort = new AbortController();
  const pending = startPostSpeech(callbacks(), abort.signal);
  const id = mockNative.start.mock.calls[0][0];
  abort.abort();
  await expect(pending).rejects.toThrow('post_speech_cancelled');
  expect(mockNative.cancel).toHaveBeenCalledWith(id);
  expect(mockListeners.size).toBe(0);
  resolve();
});
