import type { ReplyVoice } from './reply-voice';
import { createNaturalReplyVoice } from './natural-reply-voice.web';

export function createReplyVoice(natural = false): ReplyVoice | null {
  if (natural) return createNaturalReplyVoice();
  if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined')
    return null;
  const synth = speechSynthesis;
  let current: SpeechSynthesisUtterance | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let notify: ((playing: boolean) => void) | undefined;
  const stop = () => {
    clearTimeout(timer);
    if (current) {
      current.onstart = current.onend = current.onerror = null;
      current = null;
      synth.cancel();
    }
    notify?.(false);
    notify = undefined;
  };
  return {
    stop,
    speak(text, onState, onError) {
      stop();
      if (!text.trim()) return;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-TW';
      utterance.rate = 1;
      const voices = synth.getVoices();
      const voice =
        voices.find((v) => /^zh[-_]TW$/i.test(v.lang)) ??
        voices.find((v) => /^zh[-_]Hant/i.test(v.lang)) ??
        voices.find((v) => /^zh/i.test(v.lang));
      if (voice) utterance.voice = voice;
      current = utterance;
      notify = onState;
      onState(true);
      const fail = () => {
        if (current !== utterance) return;
        stop();
        onError();
      };
      // Mobile browsers may require a user gesture; leave a working replay button.
      timer = setTimeout(fail, 10_000);
      utterance.onstart = () => {
        clearTimeout(timer);
        timer = setTimeout(fail, 90_000);
      };
      utterance.onend = () => {
        if (current === utterance) stop();
      };
      utterance.onerror = fail;
      try {
        synth.speak(utterance);
      } catch {
        fail();
      }
    },
  };
}
