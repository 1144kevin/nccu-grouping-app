import { expect, it } from '@jest/globals';
import { serverClockAnchor, serverClockNow } from './server-clock';
import { createInitialDeadline, startOfDay } from './deadline-time';

it('bases a new deadline on the service clock even when the device is fifteen hours ahead', () => {
  const service = Date.parse('2026-10-16T13:00:00Z');
  const anchor = serverClockAnchor('2026-10-16T13:00:00Z', 1000, service + 15 * 3600_000);
  const now = serverClockNow(anchor, 61_000);
  expect(now).toBe(service + 60_000);
  expect(anchor.driftMs).toBe(-15 * 3600_000);
  const deadline = createInitialDeadline(now).getTime();
  expect(deadline - now).toBeGreaterThanOrEqual(3 * 3600_000);
  expect(deadline - now).toBeLessThan(3 * 3600_000 + 15 * 60_000);
  expect(startOfDay(now).getTime()).toBeLessThanOrEqual(now);
});

it('rejects a malformed clock response and tolerates an elapsed-time counter reset', () => {
  expect(() => serverClockAnchor('not-a-time', 1, 2)).toThrow('server_clock_invalid');
  const anchor = serverClockAnchor('2026-10-16T13:00:00Z', 1000, 0);
  expect(serverClockNow(anchor, 900)).toBe(anchor.serverMs);
});

it('never rounds a default deadline backwards at a quarter-hour boundary', () => {
  for (const iso of ['2026-10-16T13:00:30Z', '2026-10-16T13:14:59.500Z', '2026-10-16T13:59:59Z']) {
    const now = Date.parse(iso);
    const remaining = createInitialDeadline(now).getTime() - now;
    expect(remaining).toBeGreaterThanOrEqual(3 * 3600_000);
    expect(remaining).toBeLessThan(3 * 3600_000 + 15 * 60_000);
  }
});
