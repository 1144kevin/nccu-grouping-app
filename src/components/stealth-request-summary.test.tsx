import { expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';
import { StealthRequestSummary } from './stealth-request-summary';
import type { StealthSignalInput } from '@/lib/stealth-api';
jest.mock('@/lib/font-size-storage', () => ({
  fontSizeStorage: { getItem: () => null, setItem: jest.fn(), removeItem: jest.fn() },
}));
it('shows tentative accepted terms, the spoken budget and original-place receiving preference', async () => {
  const signal = {
    title: '宿舍吃分享餐',
    category: 'meal',
    location_id: '自強10舍',
    starts_at: '2026-10-31T08:00:00Z',
    ends_at: '2026-10-31T16:00:00Z',
    budget_max_twd: 200,
    known_cost_twd: null,
    roles: [],
    participation_preference: 'receive',
  } as unknown as StealthSignalInput;
  const screen = await render(
    <StealthRequestSummary signal={signal} createdAt="2026-10-31T08:00:00Z" />,
  );
  expect(screen.getByText('每人可接受金額 $200 以內')).toBeTruthy();
  expect(screen.getByText('偏好原地收餐，分攤自己的餐費')).toBeTruthy();
  expect(screen.getByText(/可接受時段/)).toBeTruthy();
  expect(screen.getByText(/新增於/)).toBeTruthy();
  expect(screen.queryByText(/待討論|建議時段/)).toBeNull();
});
