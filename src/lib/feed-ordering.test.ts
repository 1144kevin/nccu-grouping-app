import { expect, it } from '@jest/globals';
import { orderFeedPosts } from './feed-ordering';
import type { CorePost, Membership } from './core-api';
const post = (id: string, score: number, my_status: Membership = 'none') =>
  ({ id, my_status, semantic_recommendation: { combined_score: score } }) as CorePost;
it('places every operated membership after untouched posts while keeping their ranking', () => {
  const items = [
    post('applied', 99, 'pending'),
    post('new', 95),
    post('member', 90, 'accepted'),
    post('less', 70),
    post('cancelled', 65, 'cancelled'),
  ];
  expect(orderFeedPosts(items).map((p) => p.id)).toEqual([
    'new',
    'less',
    'applied',
    'member',
    'cancelled',
  ]);
});
it('varies near-score results only on refresh and keeps clearly different scores separate', () => {
  const items = [
    post('a', 98),
    post('b', 96),
    post('c', 94),
    post('d', 75),
    post('pending', 100, 'pending'),
  ];
  expect(orderFeedPosts(items, 1).map((p) => p.id)).toEqual(['b', 'c', 'a', 'd', 'pending']);
  expect(orderFeedPosts(items, 2).map((p) => p.id)).toEqual(['c', 'a', 'b', 'd', 'pending']);
  expect(orderFeedPosts(items).map((p) => p.id)).toEqual(items.map((p) => p.id));
});
