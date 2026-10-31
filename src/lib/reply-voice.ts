export type ReplyVoice = {
  speak: (
    text: string,
    onState: (playing: boolean) => void,
    onError: () => void,
    onPreparing?: (pending: boolean) => void,
  ) => void;
  stop: () => void;
  dispose?: () => void;
};

// The current product is a Web App. Native builds can supply their own adapter.
export function createReplyVoice(_natural = false): ReplyVoice | null {
  return null;
}
