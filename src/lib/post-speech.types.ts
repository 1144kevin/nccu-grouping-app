export type SpeechCallbacks = {
  onText: (text: string) => void;
  onEnd: (text: string) => void;
  onError: (code: string) => void;
};
export type SpeechCapture = { stop: () => void; cancel: () => void };
