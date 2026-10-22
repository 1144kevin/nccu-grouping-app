import { expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';
import { CoreRecommendationReasons } from './core-recommendation-reasons';
import type { CorePost } from '@/lib/core-api';

jest.mock('@/lib/font-size-storage', () => ({
  fontSizeStorage: { getItem: jest.fn(() => null), setItem: jest.fn(), removeItem: jest.fn() },
}));
const post = {
  id: 'synthetic',
  status: 'open',
  capacity: 3,
  joined: 2,
  recommendation: {
    version: 'rules_v2',
    score: 40,
    remaining_seats: 1,
    as_of: '2026-10-19T10:00:00Z',
    reasons: [
      { code: 'preferred_tags', text: '符合你的標籤偏好：便當' },
      { code: 'remaining_seats', text: '尚有 1 個名額' },
      { code: 'deadline', text: '30 分鐘內截止，請先確認時間' },
    ],
  },
} as CorePost;

it('shows server reasons without presenting a score as a probability or joining', async () => {
  const screen = await render(<CoreRecommendationReasons post={post} />);
  expect(screen.getByText('為什麼推薦這一團')).toBeTruthy();
  expect(screen.getByText('• 尚有 1 個名額')).toBeTruthy();
  expect(screen.getByText('• 符合你的標籤偏好：便當')).toBeTruthy();
  expect(screen.getByText(/並非成團機率/)).toBeTruthy();
  expect(screen.queryByRole('button')).toBeNull();
});

it('hides reasons for latest-feed records, full groups and closed groups', async () => {
  const screen = await render(
    <CoreRecommendationReasons post={{ ...post, recommendation: null }} />,
  );
  expect(screen.queryByTestId('recommendation-reasons-synthetic')).toBeNull();
  for (const change of [
    { joined: 3 },
    { status: 'full' as const },
    { status: 'expired' as const },
    { status: 'cancelled' as const },
  ]) {
    await screen.rerender(<CoreRecommendationReasons post={{ ...post, ...change }} />);
    expect(screen.queryByTestId('recommendation-reasons-synthetic')).toBeNull();
  }
});

it('distinguishes embedding comparison from rule reasons without promising a successful group', async () => {
  const screen = await render(<CoreRecommendationReasons post={{ ...post,
    semantic_recommendation: { similarity: 0.8, model_id: 'synthetic', combined_score: 64 },
  }} />);
  expect(screen.getByText(/已用 AI 比較/)).toBeTruthy();
  expect(screen.getByText(/不代表符合所有飲食條件/)).toBeTruthy();
  expect(screen.getByText('• 尚有 1 個名額')).toBeTruthy();
});
