import { expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import { CoreProfileScreen } from './core-profile';
import { levelLabel } from '@/lib/level-label';
import { pizzaLevels } from './pizza-level-icon';
import { randomShowerLevel } from './pizza-shower';
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
jest.mock('./profile-likes', () => ({ ProfileLikes: () => null }));
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

it('labels levels from Lv.0 to Lv.4', () => {
  expect([1, 2, 3, 4, 5].map(levelLabel)).toEqual(['Lv.0', 'Lv.1', 'Lv.2', 'Lv.3', 'Lv.4']);
});

it('lists every pizza level with its label and title', async () => {
  const screen = await render(<CoreProfileScreen />);
  for (const item of pizzaLevels) {
    expect(screen.getByText(levelLabel(item.level))).toBeTruthy();
    expect(screen.getByText(item.title)).toBeTruthy();
  }
});

it('explains each pizza level in the info dialog below the scoring rules', async () => {
  const screen = await render(<CoreProfileScreen />);
  expect(screen.queryByText('把披薩大拼起來')).toBeNull();
  await fireEvent.press(screen.getByLabelText('熟度等級說明'));
  expect(screen.getByText('把披薩大拼起來')).toBeTruthy();
  expect(screen.getByText('熟度反映已確認的參與紀錄，不是付款保證。')).toBeTruthy();
  for (const item of pizzaLevels) expect(screen.getByText(item.description)).toBeTruthy();
});

it('only drops Lv.2 to Lv.4 pizzas in the logo easter egg', () => {
  expect(randomShowerLevel(0)).toBe(3);
  expect(randomShowerLevel(0.5)).toBe(4);
  expect(randomShowerLevel(0.999)).toBe(5);
});
