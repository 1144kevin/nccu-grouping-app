import type { SpeechCallbacks, SpeechCapture } from './post-speech.types';

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
export async function startPostSpeech(
  callbacks: SpeechCallbacks,
  signal?: AbortSignal,
): Promise<SpeechCapture> {
  if (signal?.aborted) throw new Error('post_speech_cancelled');
  const host = globalThis as typeof globalThis & {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };
  const Constructor = host.SpeechRecognition ?? host.webkitSpeechRecognition;
  if (!Constructor) throw new Error('post_speech_unavailable');
  const recognition = new Constructor();
  recognition.lang = 'zh-TW';
  recognition.continuous = true;
  recognition.interimResults = true;
  let active = true;
  let text = '';
  let limit: ReturnType<typeof setTimeout> | undefined;
  let finishing: ReturnType<typeof setTimeout> | undefined;
  let stopping = false;
  const cancel = () => {
    cleanup();
    recognition.abort();
  };
  const cleanup = () => {
    active = false;
    clearTimeout(limit);
    clearTimeout(finishing);
    recognition.onresult = recognition.onerror = recognition.onend = null;
    signal?.removeEventListener('abort', cancel);
  };
  recognition.onresult = (event) => {
    if (!active) return;
    text = Array.from(event.results, (result) => result[0]?.transcript ?? '')
      .join('')
      .slice(0, 4000);
    callbacks.onText(text);
    if (text.length >= 4000) stop();
  };
  recognition.onerror = (event) => {
    if (!active) return;
    cleanup();
    recognition.abort();
    callbacks.onError(
      ['not-allowed', 'service-not-allowed'].includes(event.error)
        ? 'post_speech_permission_denied'
        : 'post_speech_failed',
    );
  };
  recognition.onend = () => {
    if (!active) return;
    cleanup();
    callbacks.onEnd(text);
  };
  const stop = () => {
    if (!active || stopping) return;
    stopping = true;
    recognition.stop();
    // Some browsers never emit end after a connection interruption.
    finishing = setTimeout(() => {
      if (!active) return;
      cleanup();
      recognition.abort();
      callbacks.onEnd(text);
    }, 5000);
  };
  try {
    recognition.start();
    signal?.addEventListener('abort', cancel, { once: true });
    limit = setTimeout(() => {
      stop();
    }, 60_000);
  } catch (error) {
    cleanup();
    throw error;
  }
  return {
    stop,
    cancel,
  };
}
