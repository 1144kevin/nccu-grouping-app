import { beforeEach, afterEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text } from 'react-native';
import { CoreSemanticFeed, validatedSemanticPosts } from './core-semantic-feed';
import { engagementApi } from '@/lib/engagement-api';
import type { CorePost } from '@/lib/core-api';

let mockFocused = true;
let mockActor = 'self';
let mockVersion = 1;
jest.mock('@/lib/core-hooks', () => ({ useCoreScreenFocused: () => mockFocused }));
jest.mock('@/lib/core-api', () => ({ coreError: () => '連線失敗' }));
jest.mock('@/lib/engagement-api', () => ({
  engagementApi: { semanticRecommendations: jest.fn(), validateSemanticRecommendations: jest.fn() },
  useAccountPreferences: () => ({ data: { version: mockVersion } }),
}));
jest.mock('@/store/auth-store', () => ({
  useAuthStore: Object.assign(
    (select: (state: { user: { id: string } }) => unknown) => select({ user: { id: mockActor } }),
    { getState: () => ({ user: { id: mockActor } }) },
  ),
}));
jest.mock('@/lib/font-size-storage', () => ({
  fontSizeStorage: { getItem: jest.fn(() => null), setItem: jest.fn(), removeItem: jest.fn() },
}));

const post = {
  id: 'bento', content: '活動剩餘便當，請來領取', version: 1,
  status: 'open', capacity: 5, joined: 1, tags: ['分享'],
  location: { name: '正門', latitude: 25, longitude: 121 },
  deadline_at: '2026-10-23T10:00:00Z', price_per_person: '0',
  semantic_recommendation: { model_id: 'synthetic', similarity: 0.8, combined_score: 60 },
} as CorePost;
const response = { items: [post], status: 'completed' as const, next_cursor: null,
  candidate_count: 1, pool_limit: 64, truncated: false, preference_version: 1 };
let client: QueryClient;
beforeEach(() => {
  mockFocused = true;
  mockActor = 'self';
  mockVersion = 1;
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  jest.mocked(engagementApi.semanticRecommendations).mockResolvedValue(response);
  jest.mocked(engagementApi.validateSemanticRecommendations).mockResolvedValue({ items: [post], next_cursor: null });
});
afterEach(() => { client.clear(); jest.resetAllMocks(); });
const ui = () => <QueryClientProvider client={client}>
  <CoreSemanticFeed renderPost={(p) => <Text>{p.content}</Text>} />
</QueryClientProvider>;
const start = async (screen: Awaited<ReturnType<typeof render>>) => {
  await fireEvent.changeText(screen.getByLabelText('首頁語義推薦需求'), '想找晚餐');
  await fireEvent.press(screen.getByRole('button', { name: '用 AI 找相關拼單' }));
};

it('only runs AI on an explicit action and validates results without more inference', async () => {
  const screen = await render(ui());
  expect(engagementApi.semanticRecommendations).not.toHaveBeenCalled();
  await start(screen);
  await waitFor(() => expect(screen.getByText(post.content)).toBeTruthy());
  expect(engagementApi.semanticRecommendations).toHaveBeenCalledWith('想找晚餐');
  expect(engagementApi.validateSemanticRecommendations).toHaveBeenCalledWith(['bento'], 1);
  await act(async () => { await client.refetchQueries({ queryKey: ['core', 'self', 'semantic-feed-validation'] }); });
  expect(engagementApi.semanticRecommendations).toHaveBeenCalledTimes(1);
  jest.mocked(engagementApi.validateSemanticRecommendations).mockResolvedValue({ items: [], next_cursor: null });
  await act(async () => { await client.refetchQueries({ queryKey: ['core', 'self', 'semantic-feed-validation'] }); });
  await waitFor(() => expect(screen.queryByText(post.content)).toBeNull());
});

it('shows an honest rules fallback when the model is unavailable', async () => {
  jest.mocked(engagementApi.semanticRecommendations).mockResolvedValue({ ...response, status: 'unavailable',
    items: [{ ...post, semantic_recommendation: null }] });
  const screen = await render(ui());
  await start(screen);
  await waitFor(() => expect(screen.getByText(/AI 暫不可用/)).toBeTruthy());
  await waitFor(() => expect(screen.getByText(post.content)).toBeTruthy());
});

it.each(['account', 'background', 'preferences'])('discards late responses on %s changes', async (change) => {
  let finish!: (value: typeof response) => void;
  jest.mocked(engagementApi.semanticRecommendations).mockReturnValue(new Promise((r) => { finish = r; }));
  const screen = await render(ui());
  await start(screen);
  if (change === 'account') mockActor = 'other';
  if (change === 'background') mockFocused = false;
  if (change === 'preferences') mockVersion = 2;
  await screen.rerender(ui());
  await act(async () => { finish(response); });
  expect(screen.queryByText(post.content)).toBeNull();
  expect(engagementApi.validateSemanticRecommendations).not.toHaveBeenCalled();
});

it('does not display stale results when eligibility refresh fails', async () => {
  jest.mocked(engagementApi.validateSemanticRecommendations).mockRejectedValue(new Error('offline'));
  const screen = await render(ui());
  await start(screen);
  await waitFor(() => expect(screen.getByText(/名額與權限更新失敗/)).toBeTruthy());
  expect(screen.queryByText(post.content)).toBeNull();
});

it('keeps semantic order but removes unauthorized, edited, full, expired and cancelled posts', () => {
  const other = { ...post, id: 'other' };
  expect(validatedSemanticPosts([post, other], [other, post]).map((p) => p.id)).toEqual(['bento', 'other']);
  expect(validatedSemanticPosts([post], [])).toEqual([]);
  for (const change of [ { version: 2 }, { joined: 5 }, { status: 'expired' as const },
    { status: 'cancelled' as const }, { content: '不同內容' }, { price_per_person: '50' } ]) {
    expect(validatedSemanticPosts([post], [{ ...post, ...change }])).toEqual([]);
  }
});
