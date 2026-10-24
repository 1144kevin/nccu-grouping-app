import { expect, it } from '@jest/globals';
import { clearSharedPostReturn, pendingSharedPost, rememberSharedPost } from './post-login-return';

it('retains only a validated post id and consumes no arbitrary external redirect', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  clearSharedPostReturn();
  rememberSharedPost('https://untrusted.example/');
  expect(pendingSharedPost()).toBeNull();
  rememberSharedPost(id);
  expect(pendingSharedPost()).toBe(id);
  clearSharedPostReturn();
  expect(pendingSharedPost()).toBeNull();
});
