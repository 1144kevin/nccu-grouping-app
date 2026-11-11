import { stealthApi } from './stealth-api';
import type { ReplyVoice } from './reply-voice';

export async function consumeSpeechStream(
  stream: ReadableStream<Uint8Array>,
  onAudio: (data: string, rate: number) => void,
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let done = false;
  let total = 0;
  try {
    while (true) {
      const result = await reader.read();
      buffer += decoder.decode(result.value, { stream: !result.done });
      if (buffer.length > 512000) throw new Error('oversized audio event');
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const event = JSON.parse(line.slice(5));
        if (event.type === 'error') throw new Error(event.code ?? 'speech unavailable');
        if (event.type === 'audio') {
          if (typeof event.data !== 'string' || event.sample_rate !== 24000)
            throw new Error('invalid PCM');
          total += event.data.length;
          if (total > 5 * 1024 * 1024) throw new Error('audio too large');
          onAudio(event.data, event.sample_rate);
        } else if (event.type === 'done') done = true;
      }
      if (result.done) break;
    }
    if (!done || !total) throw new Error('incomplete audio');
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export function createStreamingReplyVoice(): ReplyVoice | null {
  const AudioContextClass =
    typeof window === 'undefined'
      ? undefined
      : (window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  if (!AudioContextClass) return null;
  const context = new AudioContextClass();
  const sources = new Set<AudioBufferSourceNode>();
  let epoch = 0;
  let controller: AbortController | undefined;
  let notify: ((playing: boolean) => void) | undefined;
  let preparing: ((pending: boolean) => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let scheduledUntil = 0;
  const stop = () => {
    epoch += 1;
    controller?.abort();
    controller = undefined;
    clearTimeout(timer);
    for (const source of sources) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        /* Already ended. */
      }
      source.disconnect();
    }
    sources.clear();
    notify?.(false);
    preparing?.(false);
    notify = preparing = undefined;
  };
  return {
    stop,
    dispose() {
      stop();
      void context.close().catch(() => undefined);
    },
    speak(text, onState, onError, onPreparing) {
      stop();
      if (!text.trim()) return;
      const current = epoch;
      controller = new AbortController();
      notify = onState;
      preparing = onPreparing;
      notify(true);
      preparing?.(true);
      let complete = false;
      let started = false;
      const fail = (error?: unknown) => {
        if (current === epoch) {
          stop();
          onError(error instanceof Error ? error.message : undefined);
        }
      };
      scheduledUntil = context.currentTime;
      const resumed = context.resume(); // Runs in the initial speaker tap on Safari.
      const signal = controller.signal;
      timer = setTimeout(() => fail(), 45_000);
      void resumed
        .then(async () => {
          if (current !== epoch) return;
          const stream = await stealthApi.speechStream(text, signal);
          if (current !== epoch) {
            await stream.cancel();
            return;
          }
          await consumeSpeechStream(stream, (data, rate) => {
            if (current !== epoch) return;
            const bytes = atob(data);
            if (!bytes.length || bytes.length % 2) throw new Error('invalid PCM');
            const buffer = context.createBuffer(1, bytes.length / 2, rate);
            const samples = buffer.getChannelData(0);
            for (let i = 0; i < samples.length; i++) {
              const value = bytes.charCodeAt(i * 2) | (bytes.charCodeAt(i * 2 + 1) << 8);
              samples[i] = (value >= 32768 ? value - 65536 : value) / 32768;
            }
            const source = context.createBufferSource();
            source.buffer = buffer;
            source.connect(context.destination);
            sources.add(source);
            source.onended = () => {
              source.disconnect();
              sources.delete(source);
              if (complete && !sources.size && current === epoch) stop();
            };
            scheduledUntil = Math.max(context.currentTime + 0.04, scheduledUntil);
            source.start(scheduledUntil);
            scheduledUntil += buffer.duration;
            if (!started) {
              started = true;
              preparing?.(false);
              clearTimeout(timer);
              timer = setTimeout(() => fail(), 90_000);
            }
          });
          complete = true;
          if (!sources.size && current === epoch) stop();
        })
        .catch(fail);
    },
  };
}
