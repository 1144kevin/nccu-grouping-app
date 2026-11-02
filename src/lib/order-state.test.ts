import { expect, it } from '@jest/globals';
import { orderStateLabel } from './order-state';
import type { CorePost } from './core-api';
const post = { status: 'open', my_status: 'host', joined: 1, capacity: 3 } as CorePost;
it('distinguishes application review, assembling a full group, and actual completion', () => {
  expect(orderStateLabel({ ...post, my_status: 'pending' })).toBe('審核中');
  expect(orderStateLabel(post)).toBe('待成團');
  expect(orderStateLabel({ ...post, my_status: 'accepted', joined: 2 })).toBe('待成團');
  expect(orderStateLabel({ ...post, status: 'full', joined: 3 })).toBe('進行中');
  expect(orderStateLabel({ ...post, status: 'expired', completed: true })).toBe('已完成');
  expect(orderStateLabel({ ...post, status: 'cancelled' })).toBe('已取消');
  expect(orderStateLabel({ ...post, status: 'expired' })).toBe('已截止');
});
