import { expect, it } from '@jest/globals';
import { displayTime, displayTimestamp } from './display-time';
it('shows a compact AM/PM clock without seconds and adds a day only outside today', () => {
  const time = new Date(2026, 10, 2, 14, 41, 53);
  expect(displayTime(time)).toBe('下午2:41');
  expect(displayTimestamp(time, new Date(2026, 10, 2, 18))).toBe('下午2:41');
  expect(displayTimestamp(time, new Date(2026, 10, 3, 18))).toBe('11/2 下午2:41');
  expect(displayTimestamp('invalid')).toBe('');
});
