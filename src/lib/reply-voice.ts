import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import { stealthApi } from './stealth-api';

export type ReplyVoice = {
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
 * Native iOS/Android reply voice adapter using backend TTS WAV + expo-audio.
 */
export function createReplyVoice(_natural = false): ReplyVoice | null {
  let epoch = 0;
  let controller: AbortController | undefined;
  let player: AudioPlayer | undefined;
  let subscription: { remove: () => void } | undefined;
  let tempFile: File | undefined;
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
      player?.remove();
    } catch {
      // Ignore already-released player errors.
    }
    player = undefined;
    try {
      if (tempFile?.exists) tempFile.delete();
    } catch {
      // Ignore cache cleanup errors.
    }
    tempFile = undefined;
  };

  const stop = () => {
    epoch += 1;
    controller?.abort();
    controller = undefined;
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
      if (!text.trim()) return;
      const current = epoch;
      controller = new AbortController();
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
        const result = await stealthApi.speech(text, controller.signal);
        if (current !== epoch) return;
        const file = new File(Paths.cache, `stealth-reply-${current}-${Date.now()}.wav`);
        file.create({ overwrite: true });
        file.write(result.audio_base64, { encoding: 'base64' });
        tempFile = file;
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
        if (current !== epoch) return;
        const nextPlayer = createAudioPlayer(file.uri);
        player = nextPlayer;
        onPreparing?.(false);
        subscription = nextPlayer.addListener('playbackStatusUpdate', (status) => {
          if (status.didJustFinish && current === epoch) {
            stop();
          }
        });
        clearTimeout(timer);
        timer = setTimeout(() => fail('timeout'), 90_000);
        nextPlayer.play();
      })().catch(fail);
    },
  };
}
