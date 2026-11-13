import type { AudioPlayer } from 'expo-audio';
import { api } from './api';
import { tokenStorage } from './token-storage';

export type ReplyVoice = {
  unlock?: () => void;
  speak: (
    text: string,
    onState: (playing: boolean) => void,
    onError: (code?: string) => void,
    onPreparing?: (pending: boolean) => void,
  ) => void;
  stop: () => void;
  dispose?: () => void;
};

/**
 * Native iOS/Android reply voice adapter streaming WAV audio via expo-audio.
 */
export function createReplyVoice(_natural = false): ReplyVoice | null {
  let epoch = 0;
  let player: AudioPlayer | undefined;
  let subscription: { remove: () => void } | undefined;
  let notify: ((playing: boolean) => void) | undefined;
  let preparing: ((pending: boolean) => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const cleanupPlayer = () => {
    clearTimeout(timer);
    timer = undefined;
    subscription?.remove();
    subscription = undefined;
    try {
      player?.pause();
    } catch {
      // Ignore cleanup errors on already-released players.
    }
    try {
      player?.remove();
    } catch {
      // Ignore cleanup errors on already-released players.
    }
    player = undefined;
  };

  const stop = () => {
    epoch += 1;
    cleanupPlayer();
    preparing?.(false);
    preparing = undefined;
    notify?.(false);
    notify = undefined;
  };

  return {
    stop,
    dispose: stop,
    speak(text, onState, onError, onPreparing) {
      stop();
      const cleaned = text.trim();
      if (!cleaned) return;
      const current = epoch;
      notify = onState;
      preparing = onPreparing;
      onPreparing?.(true);
      onState(true);

      const fail = (err?: unknown) => {
        if (current !== epoch) return;
        const message =
          err instanceof Error ? err.message : typeof err === 'string' ? err : undefined;
        stop();
        onError(message);
      };

      timer = setTimeout(() => fail('timeout'), 45_000);
      void (async () => {
        const token = await tokenStorage.get();
        if (current !== epoch) return;
        const baseURL = (api.defaults.baseURL ?? '').replace(/\/$/, '');
        const uri = `${baseURL}/stealth-cloud/speech-audio?text=${encodeURIComponent(cleaned)}`;
        const source = token ? { uri, headers: { Authorization: `Bearer ${token}` } } : uri;
        const {
          createAudioPlayer,
          setAudioModeAsync,
          setIsAudioActiveAsync,
        } = require('expo-audio') as typeof import('expo-audio');
        await setIsAudioActiveAsync?.(true);
        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: false,
          interruptionMode: 'doNotMix',
        });
        if (current !== epoch) return;
        const nextPlayer = createAudioPlayer(source);
        player = nextPlayer;
        let started = false;
        subscription = nextPlayer.addListener('playbackStatusUpdate', (status) => {
          if (current !== epoch) return;
          if (status.isLoaded && !started) {
            started = true;
            onPreparing?.(false);
            clearTimeout(timer);
            timer = setTimeout(() => fail('timeout'), 90_000);
            if (!status.playing) nextPlayer.play();
          }
          if (status.didJustFinish) {
            stop();
          }
        });
        nextPlayer.play();
      })().catch(fail);
    },
  };
}
