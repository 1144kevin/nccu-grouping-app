import { stealthApi } from './stealth-api';
import type { ReplyVoice } from './reply-voice';
import { createStreamingReplyVoice } from './streaming-reply-voice.web';

// A tiny silent WAV starts the same audio element in the user's tap gesture.
const SILENCE =
  'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQIAAAAAAA==';

function createBufferedReplyVoice(): ReplyVoice | null {
  if (typeof Audio === 'undefined') return null;
  const audio = new Audio();
  let epoch = 0;
  let controller: AbortController | undefined;
  let notify: ((playing: boolean) => void) | undefined;
  let preparing: ((pending: boolean) => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    epoch += 1;
    controller?.abort();
    controller = undefined;
    clearTimeout(timer);
    audio.onended = audio.onerror = null;
    audio.pause();
    audio.removeAttribute('src');
    preparing?.(false);
    notify?.(false);
    notify = preparing = undefined;
  };
  return {
    stop,
    unlock() {
      try {
        audio.src = SILENCE;
        void audio.play().catch(() => undefined);
      } catch {
        // Playback errors are reported when the response is played.
      }
    },
    speak(text, onState, onError, onPreparing) {
      stop();
      if (!text.trim()) return;
      const current = epoch;
      controller = new AbortController();
      notify = onState;
      preparing = onPreparing;
      onPreparing?.(true);
      onState(true);
      const fail = (err?: unknown) => {
        if (current === epoch) {
          const code = err instanceof Error ? err.message : typeof err === 'string' ? err : undefined;
          stop();
          onError(code);
        }
      };
      // Keep playback possible on Safari after the asynchronous speech request.
      audio.src = SILENCE;
      void audio.play().catch(() => undefined);
      timer = setTimeout(() => fail('timeout'), 45_000);
      void stealthApi
        .speech(text, controller.signal)
        .then(async (result) => {
          if (current !== epoch) return;
          audio.pause();
          audio.src = `data:audio/wav;base64,${result.audio_base64}`;
          audio.onended = () => {
            if (current === epoch) stop();
          };
          audio.onerror = () => fail('audio_element_error');
          onPreparing?.(false);
          clearTimeout(timer);
          timer = setTimeout(() => fail('timeout'), 90_000);
          await audio.play();
        })
        .catch(fail);
    },
  };
}

export function createNaturalReplyVoice(): ReplyVoice | null {
  const streaming = createStreamingReplyVoice();
  const buffered = createBufferedReplyVoice();
  if (!streaming) return buffered;
  if (!buffered) return streaming;
  let active: ReplyVoice = streaming;
  return {
    unlock() {
      streaming.unlock?.();
      buffered.unlock?.();
    },
    dispose() {
      streaming.dispose?.();
      buffered.dispose?.();
    },
    stop() {
      streaming.stop();
      buffered.stop();
    },
    speak(text, onState, onError, onPreparing) {
      active = streaming;
      buffered.stop();
      streaming.speak(
        text,
        (playing) => {
          if (active === streaming) onState(playing);
        },
        (code) => {
          if (
            code === 'openai_budget_exhausted' ||
            code === 'openai_quota_or_rate_limit'
          ) {
            onError(code);
            return;
          }
          active = buffered;
          buffered.speak(text, onState, onError, onPreparing);
        },
        onPreparing,
      );
    },
  };
}
