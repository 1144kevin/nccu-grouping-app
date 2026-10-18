import type {
  StealthFactCode,
  StealthMatch,
  StealthSemanticItem,
  StealthSemanticResult,
} from './stealth-api';

export const semanticReasonLabels: Record<StealthFactCode, string> = {
  location: '取餐地點一致',
  time: '可用時間有交集',
  category: '符合本人確認的餐點選項',
  shared_tags: '有共同的已確認偏好',
  offer: '包含明確提供的資源',
  pickup_volunteer: '有人明確願意取餐',
  cost_unknown: '實際費用仍待確認',
  order_missing: '下單者仍待確認',
  pickup_missing: '取餐者仍待確認',
  coupon_terms: '優惠券條件仍待持有人確認',
};
export const pendingFactCodes = new Set<StealthFactCode>([
  'cost_unknown',
  'order_missing',
  'pickup_missing',
  'coupon_terms',
]);

// Canonical snapshots make equivalent responses independent of JSON property order.
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonical(v)]),
    );
  return value;
}

export function eligibleSemanticMatch(match: StealthMatch, now: number): boolean {
  return ['pending', 'ready'].includes(match.status) && Date.parse(match.expires_at) > now;
}

export function selectSemanticMatches(
  matches: StealthMatch[],
  result: StealthSemanticResult | undefined,
  now: number,
) {
  const ordered = [...matches].sort(
    (a, b) =>
      Number(a.status === 'unavailable') - Number(b.status === 'unavailable') || b.score - a.score,
  );
  const snapshots = new Map(result?.items.map((m) => [m.id, JSON.stringify(canonical(m))]));
  const latest = new Map(matches.map((m) => [m.id, m]));
  const valid = new Map<string, StealthSemanticItem>();
  for (const item of result?.ranking.items ?? []) {
    const match = latest.get(item.key);
    if (
      match &&
      eligibleSemanticMatch(match, now) &&
      snapshots.get(item.key) === JSON.stringify(canonical(match))
    )
      valid.set(item.key, item);
  }
  const staleCount = (result?.ranking.items.length ?? 0) - valid.size;
  // Only a completed embedding run may change order. No model score is a probability.
  if (result?.ranking.status === 'completed') {
    const positions = new Map([...valid.keys()].map((id, i) => [id, i]));
    ordered.sort(
      (a, b) =>
        (positions.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
        (positions.get(b.id) ?? Number.MAX_SAFE_INTEGER),
    );
  }
  return { ordered, valid, staleCount };
}
