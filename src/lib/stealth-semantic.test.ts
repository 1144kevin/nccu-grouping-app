import { expect, it } from '@jest/globals';
import type { StealthMatch, StealthSemanticResult } from './stealth-api';
import { selectSemanticMatches } from './stealth-semantic';

const now = Date.parse('2026-10-19T10:00:00Z');
const match = (id: string, score: number) =>
  ({
    id,
    score,
    status: 'pending',
    expires_at: '2026-10-19T11:00:00Z',
    terms_revision: 0,
    unknowns: [],
  }) as unknown as StealthMatch;
const a = match('a', 90),
  b = match('b', 60);
const result: StealthSemanticResult = {
  items: [a, b],
  ranking: {
    status: 'completed',
    embedding_model: 'synthetic',
    requires_unanimous_confirmation: true,
    warnings: [],
    items: ['b', 'a'].map((key) => ({
      key,
      similarity: 0.8,
      explanations: [],
      review: null,
      review_model: null,
      review_status: 'not_requested',
    })),
  },
};

it('ranks only fresh authorized matches and retains unranked records', () => {
  const c = match('c', 95);
  const selected = selectSemanticMatches([a, b, c], result, now);
  expect(selected.ordered.map((m) => m.id)).toEqual(['b', 'a', 'c']);
  expect(selected.valid.size).toBe(2);
  expect(a.terms_revision).toBe(0);
});

it('discards old analysis after edits, consent changes, expiry or lost visibility', () => {
  for (const change of [
    { terms_revision: 1 },
    { confirmed_count: 1 },
    { status: 'formed' },
    { expires_at: '2026-10-19T09:00:00Z' },
  ]) {
    const selected = selectSemanticMatches([a, { ...b, ...change } as StealthMatch], result, now);
    expect(selected.valid.has('b')).toBe(false);
    expect(selected.staleCount).toBe(1);
  }
  expect(selectSemanticMatches([a], result, now).ordered.map((m) => m.id)).toEqual(['a']);
  expect(selectSemanticMatches([a, b], result, now + 3600000).valid.size).toBe(0);
});

it('keeps rule order when embeddings are unavailable and cannot resurrect removed matches', () => {
  const unavailable = { ...result, ranking: { ...result.ranking, status: 'unavailable' as const } };
  expect(selectSemanticMatches([a, b], unavailable, now).ordered.map((m) => m.id)).toEqual([
    'a',
    'b',
  ]);
  expect(selectSemanticMatches([], result, now).ordered).toEqual([]);
});
