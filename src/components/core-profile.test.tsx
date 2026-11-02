import { expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';
import { CoreProfileScreen } from './core-profile';
let mockScore = 0;

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  Link: ({ children }: { children: unknown }) => children,
}));
jest.mock('@/lib/core-api', () => ({ CORE_SUPABASE_MODE: true, coreError: () => '' }));
jest.mock('@/lib/core-hooks', () => ({ useCorePosts: () => ({ posts: [], isPending: false }) }));
jest.mock('@/lib/social-api', () => ({
  useExperience: () => ({ data: { score: mockScore, level: 1, completed_post_ids: [] } }),
}));
jest.mock('@/store/auth-store', () => ({
  useAuthStore: (select: (s: unknown) => unknown) =>
    select({ user: { id: 'self', display_name: '測試同學', created_at: '2026-10-01T00:00:00Z' } }),
}));
jest.mock('@/lib/font-size-storage', () => ({
  fontSizeStorage: { getItem: () => null, setItem: jest.fn(), removeItem: jest.fn() },
}));

it('uses the real account score, starting at zero rather than a preview score', async () => {
  mockScore = 0;
  const screen = await render(<CoreProfileScreen />);
  expect(screen.getByText('0/100')).toBeTruthy();
  expect(screen.getByLabelText('熟度進度')).toHaveProp('accessibilityValue', {
    min: 0,
    max: 100,
    now: 0,
  });
  expect(screen.getByText('一分熟揪團夥伴')).toBeTruthy();
  expect(screen.getByText('還沒有過往拼單')).toBeTruthy();
  mockScore = 50;
  await screen.rerender(<CoreProfileScreen />);
  expect(screen.getByText('50/100')).toBeTruthy();
});
