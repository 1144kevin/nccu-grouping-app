import { afterEach, expect, it, jest } from '@jest/globals';
import { act, cleanup, render } from '@testing-library/react-native';
import { useChatDateIndicator } from './chat-date-indicator';
import { displayDay } from '@/lib/display-time';
import { useEffect } from 'react';
jest.mock('@/lib/font-size-storage', () => ({
  fontSizeStorage: { getItem: () => null, setItem: jest.fn(), removeItem: jest.fn() },
}));
let callbacks: ReturnType<typeof useChatDateIndicator>;
function Example() {
  const indicator = useChatDateIndicator();
  useEffect(() => {
    callbacks = indicator;
  }, [indicator]);
  return indicator.indicator;
}
afterEach(async () => {
  await cleanup();
  jest.useRealTimers();
});
it('briefly shows the date of the top visible older message, then hides it', async () => {
  jest.useFakeTimers();
  const screen = await render(<Example />);
  const old = new Date(Date.now() - 2 * 86400000).toISOString();
  await act(async () => {
    callbacks.onViewableItemsChanged({
      viewableItems: [{ item: { created_at: old }, index: 10, isViewable: true, key: 'old' }],
    });
    callbacks.onScroll();
  });
  expect(screen.getByText(displayDay(old))).toBeTruthy();
  await act(async () => {
    jest.advanceTimersByTime(1400);
  });
  expect(screen.queryByText(displayDay(old))).toBeNull();
});
