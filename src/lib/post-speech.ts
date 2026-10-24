import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { isExpoGo } from './app-runtime';
import type { SpeechCallbacks, SpeechCapture } from './post-speech.types';

type SpeechEvent = { id: string; text?: string; code?: string };
type SpeechModule = {
  start(id: string): Promise<void>;
  stop(id: string): void;
  cancel(id: string): void;
  addListener(event: string, callback: (value: SpeechEvent) => void): { remove(): void };
};
const native =
  Platform.OS === 'ios' && !isExpoGo()
    ? requireOptionalNativeModule<SpeechModule>('NCCUPostSpeech')
    : null;
let serial = 0;

export async function startPostSpeech(
  callbacks: SpeechCallbacks,
  signal?: AbortSignal,
): Promise<SpeechCapture> {
  if (!native) throw new Error('post_speech_unavailable');
  const module = native;
  const id = `post-speech-${Date.now()}-${++serial}`;
  if (signal?.aborted) throw new Error('post_speech_cancelled');
  let active = true;
  const subscriptions: { remove(): void }[] = [];
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let aborted: (() => void) | undefined;
  const cleanup = () => {
    active = false;
    if (timeout) clearTimeout(timeout);
    subscriptions.forEach((s) => s.remove());
    if (aborted) signal?.removeEventListener('abort', aborted);
  };
  subscriptions.push(
    module.addListener('text', (event) => {
      if (active && event.id === id) callbacks.onText(event.text ?? '');
    }),
  );
  subscriptions.push(
    module.addListener('end', (event) => {
      if (!active || event.id !== id) return;
      cleanup();
      callbacks.onEnd(event.text ?? '');
    }),
  );
  subscriptions.push(
    module.addListener('error', (event) => {
      if (!active || event.id !== id) return;
      cleanup();
      callbacks.onError(event.code ?? 'post_speech_failed');
    }),
  );
  try {
    await Promise.race([
      module.start(id),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('post_speech_start_timeout')), 30_000);
      }),
      new Promise<never>((_, reject) => {
        aborted = () => {
          module.cancel(id);
          reject(new Error('post_speech_cancelled'));
        };
        signal?.addEventListener('abort', aborted, { once: true });
      }),
    ]);
    if (timeout) clearTimeout(timeout);
    if (aborted) signal?.removeEventListener('abort', aborted);
  } catch (error) {
    cleanup();
    module.cancel(id);
    throw error;
  }
  return {
    stop: () => {
      if (active) module.stop(id);
    },
    cancel: () => {
      cleanup();
      module.cancel(id);
    },
  };
}
