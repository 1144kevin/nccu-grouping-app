export type ServerClockAnchor = { serverMs: number; monotonicMs: number; driftMs: number };

export function serverClockAnchor(serverTime: string, monotonicMs: number, deviceMs: number): ServerClockAnchor {
  const serverMs = Date.parse(serverTime);
  if (!Number.isFinite(serverMs)) throw new Error('server_clock_invalid');
  return { serverMs, monotonicMs, driftMs: serverMs - deviceMs };
}

export function serverClockNow(anchor: ServerClockAnchor, monotonicMs: number): number {
  return anchor.serverMs + Math.max(0, monotonicMs - anchor.monotonicMs);
}

export function monotonicNow(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}
