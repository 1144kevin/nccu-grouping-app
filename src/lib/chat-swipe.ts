export const CHAT_ACTION_WIDTH = 152;

// Once a horizontal swipe is recognized, always latch open instead of springing back.
export function chatSwipeTarget(initial: number, delta: number): number {
  if (initial === 0) return delta > 0 ? CHAT_ACTION_WIDTH : -CHAT_ACTION_WIDTH;
  if (initial > 0) {
    if (delta >= 0) return CHAT_ACTION_WIDTH;
    return initial + delta < -8 ? -CHAT_ACTION_WIDTH : 0;
  }
  if (delta <= 0) return -CHAT_ACTION_WIDTH;
  return initial + delta > 8 ? CHAT_ACTION_WIDTH : 0;
}
