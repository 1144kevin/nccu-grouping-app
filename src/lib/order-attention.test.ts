import { expect, it } from '@jest/globals';
import type { CoreOrderActivity } from './core-api';
import { pendingOrderGroups } from './order-attention';

const pending = {
  id: 'request-1',
  post_id: 'post-1',
  post_content: '一起吃飯',
  requester_name: '小安',
  requester_id: 'user-1',
  status: 'pending',
  kind: 'hosted_request',
  occurred_at: '2026-10-23T10:00:00Z',
  post_cancelled: false,
  post_expired: false,
} as CoreOrderActivity;
it('groups pending requests per post without duplicating paged records', () => {
  expect(
    pendingOrderGroups([pending, pending, { ...pending, id: 'request-2', requester_name: '小晴' }]),
  ).toEqual([{ postId: 'post-1', content: '一起吃飯', names: ['小安', '小晴'], count: 2 }]);
});
it('does not prompt review for accepted, withdrawn, closed or personal requests', () => {
  const excluded: CoreOrderActivity[] = [
    { ...pending, id: 'accepted', status: 'accepted' },
    { ...pending, id: 'cancelled', status: 'cancelled' },
    { ...pending, id: 'rejected', status: 'rejected' },
    { ...pending, id: 'expired-post', post_expired: true },
    { ...pending, id: 'cancelled-post', post_cancelled: true },
    { ...pending, id: 'my-request', kind: 'my_request' },
  ];
  expect(pendingOrderGroups(excluded)).toEqual([]);
});
