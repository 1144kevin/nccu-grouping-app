export type ReplyVoice = {
  speak: (text: string, onState: (playing: boolean) => void, onError: () => void) => void;
  stop: () => void;
};

// The current product is a Web App. Native builds can supply their own adapter.
export function createReplyVoice(): ReplyVoice | null {
  return null;
}
