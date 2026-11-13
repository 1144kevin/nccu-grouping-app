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

      const fail = (step: string, err?: unknown) => {
        if (current !== epoch) return;
        const detail =
          err instanceof Error ? err.message : typeof err === 'string' ? err : '';
        stop();
        onError(detail ? `${step}:${detail}` : step);
      };

      timer = setTimeout(() => fail('timeout_load'), 45_000);
      void (async () => {
        let token: string | null = null;
        try {
          // Ensure access token is refreshed via axios interceptor if expired.
          await api.get('/stealth-cloud/quick-status');
          token = await tokenStorage.get();
        } catch {
          token = await tokenStorage.get();
        }
        if (current !== epoch) return;
        const baseURL = (api.defaults.baseURL ?? '').replace(/\/$/, '');
        if (!baseURL) {
          fail('missing_base_url');
          return;
        }
        const uri = `${baseURL}/stealth-cloud/speech-audio?text=${encodeURIComponent(cleaned)}`;
        const source = token ? { uri, headers: { Authorization: `Bearer ${token}` } } : uri;

        let audioMod: typeof import('expo-audio');
        try {
          audioMod = require('expo-audio') as typeof import('expo-audio');
        } catch (e) {
          fail('audio_module', e);
          return;
        }

        try {
          await audioMod.setIsAudioActiveAsync?.(true);
        } catch {
          // Non-fatal on platforms/runtimes where setIsAudioActiveAsync is unnecessary.
        }
        try {
          await audioMod.setAudioModeAsync({
            playsInSilentMode: true,
            allowsRecording: false,
          });
        } catch (e) {
          fail('audio_mode', e);
          return;
        }
        if (current !== epoch) return;

        let nextPlayer: AudioPlayer;
        try {
          nextPlayer = audioMod.createAudioPlayer(source);
        } catch (e) {
          fail('player_create', e);
          return;
        }
        player = nextPlayer;
        let started = false;
        subscription = nextPlayer.addListener('playbackStatusUpdate', (status) => {
          if (current !== epoch) return;
          if (status.isLoaded && !started) {
            started = true;
            onPreparing?.(false);
            clearTimeout(timer);
            timer = setTimeout(() => fail('timeout_play'), 90_000);
            if (!status.playing) {
              try {
                nextPlayer.play();
              } catch (e) {
                fail('player_play', e);
              }
            }
          }
          if (status.didJustFinish) {
            stop();
          }
        });
        try {
          nextPlayer.play();
        } catch (e) {
          fail('player_play_init', e);
        }
      })().catch((e) => fail('unexpected', e));
    },
  };
}
