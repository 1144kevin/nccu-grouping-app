import { afterEach, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';
import { router } from 'expo-router';
import { PostLoginReturn } from './post-login-return';
import {
  clearSharedPostReturn,
  pendingSharedPost,
  rememberSharedPost,
} from '@/lib/post-login-return';
let mockPath = '/';
let mockSetup = true;
jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
  usePathname: () => mockPath,
  useRootNavigationState: () => ({ key: 'root' }),
}));
jest.mock('@/store/auth-store', () => ({
  useAuthStore: (selector: (s: object) => unknown) =>
    selector({ user: { id: 'member', profile_setup_required: mockSetup }, ready: true }),
}));
afterEach(() => {
  clearSharedPostReturn();
  jest.clearAllMocks();
  mockPath = '/';
  mockSetup = true;
});
it('waits for signup profile and callback navigation to finish before returning exactly once to the shared order', async () => {
  const id = '11111111-1111-4111-8111-111111111111';
  rememberSharedPost(id);
  const screen = await render(<PostLoginReturn />);
  expect(router.replace).not.toHaveBeenCalled();
  mockSetup = false;
  mockPath = '/edit-profile';
  await screen.rerender(<PostLoginReturn />);
  expect(router.replace).not.toHaveBeenCalled();
  mockPath = '/auth/callback';
  await screen.rerender(<PostLoginReturn />);
  expect(router.replace).not.toHaveBeenCalled();
  mockPath = '/';
  await screen.rerender(<PostLoginReturn />);
  expect(router.replace).toHaveBeenCalledWith(`/order/${id}`);
  expect(pendingSharedPost()).toBeNull();
});
