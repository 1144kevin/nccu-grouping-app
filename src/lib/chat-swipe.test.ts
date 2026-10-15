import { describe, it, expect } from '@jest/globals';
import { chatSwipeTarget, CHAT_ACTION_WIDTH } from './chat-swipe';

describe('chat swipe latch', () => {
  it('opens fully even after a short recognized swipe', () => {
    for (const distance of [9, 15, 39, 60, 200]) {
      expect(chatSwipeTarget(0, distance)).toBe(CHAT_ACTION_WIDTH);
      expect(chatSwipeTarget(0, -distance)).toBe(-CHAT_ACTION_WIDTH);
    }
  });
  it('keeps the options open when swiping farther in the same direction', () => {
    expect(chatSwipeTarget(CHAT_ACTION_WIDTH, 12)).toBe(CHAT_ACTION_WIDTH);
    expect(chatSwipeTarget(-CHAT_ACTION_WIDTH, -12)).toBe(-CHAT_ACTION_WIDTH);
  });
  it('closes on a deliberate reverse swipe and supports switching sides', () => {
    expect(chatSwipeTarget(CHAT_ACTION_WIDTH, -12)).toBe(0);
    expect(chatSwipeTarget(-CHAT_ACTION_WIDTH, 12)).toBe(0);
    expect(chatSwipeTarget(CHAT_ACTION_WIDTH, -180)).toBe(-CHAT_ACTION_WIDTH);
    expect(chatSwipeTarget(-CHAT_ACTION_WIDTH, 180)).toBe(CHAT_ACTION_WIDTH);
  });
});
