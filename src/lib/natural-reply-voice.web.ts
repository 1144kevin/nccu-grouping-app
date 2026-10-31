import { stealthApi } from './stealth-api';
import type { ReplyVoice } from './reply-voice';
import { createStreamingReplyVoice } from './streaming-reply-voice.web';

// A tiny silent WAV starts the same audio element in the user's tap gesture.
const SILENCE =
  'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQIAAAAAAA==';
export function createNaturalReplyVoice(): ReplyVoice | null {
  const streaming = createStreamingReplyVoice();
  if (streaming) return streaming;
  if (typeof Audio === 'undefined') return null;
  const audio = new Audio();
  let epoch = 0;
  let controller: AbortController | undefined;
  let notify: ((playing: boolean) => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    epoch += 1;
    controller?.abort();
    controller = undefined;
    clearTimeout(timer);
    audio.onended = audio.onerror = null;
    audio.pause();
    audio.removeAttribute('src');
    notify?.(false);
    notify = undefined;
  };
  return {
    stop,
    speak(text, onState, onError) {
      stop();
      if (!text.trim()) return;
      const current = epoch;
      controller = new AbortController();
      notify = onState;
      onState(true);
      const fail = () => {
        if (current === epoch) {
          stop();
          onError();
        }
      };
      // Keep playback possible on Safari after the asynchronous speech request.
      audio.src = SILENCE;
      void audio.play().catch(() => undefined);
      timer = setTimeout(fail, 45_000);
      void stealthApi
        .speech(text, controller.signal)
        .then(async (result) => {
          if (current !== epoch) return;
          audio.pause();
          audio.src = `data:audio/wav;base64,${result.audio_base64}`;
          audio.onended = () => {
            if (current === epoch) stop();
          };
          audio.onerror = fail;
          clearTimeout(timer);
          timer = setTimeout(fail, 90_000);
          await audio.play();
        })
        .catch(fail);
    },
  };
}
