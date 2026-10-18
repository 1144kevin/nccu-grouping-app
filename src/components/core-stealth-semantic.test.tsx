import { afterEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { StealthSemanticMatches, StealthSemanticSummary } from './core-stealth-semantic';
import { stealthApi, type StealthMatch, type StealthSemanticResult } from '@/lib/stealth-api';

jest.mock('expo-router', () => ({ router: {} }));
jest.mock('@/lib/api', () => ({ api: {} }));
jest.mock('@/lib/stealth-api', () => ({
  stealthApi: { semantic: jest.fn(), consent: jest.fn(), terms: jest.fn(), decide: jest.fn() },
}));
jest.mock('@/lib/core-api', () => ({ coreError: () => '本機模型暫不可用，原配對仍可使用' }));
jest.mock('@/lib/font-size-storage', () => ({
  fontSizeStorage: { getItem: jest.fn(() => null), setItem: jest.fn(), removeItem: jest.fn() },
}));
let mockActor = 'self';
jest.mock('@/store/auth-store', () => ({
  useAuthStore: Object.assign(
    (select: (s: { user: { id: string } }) => unknown) => select({ user: { id: mockActor } }),
    { getState: () => ({ user: { id: mockActor } }) },
  ),
}));
const now = () => Date.parse('2026-10-19T10:00:00Z');
const a = {
  id: 'a',
  score: 90,
  status: 'pending',
  expires_at: '2026-10-19T11:00:00Z',
  terms_revision: 0,
  unknowns: ['費用待向商家確認'],
} as unknown as StealthMatch;
const b = { ...a, id: 'b', score: 60 };
const data: StealthSemanticResult = {
  items: [a, b],
  ranking: {
    status: 'completed',
    embedding_model: 'synthetic',
    requires_unanimous_confirmation: true,
    warnings: [],
    items: [
      {
        key: 'b',
        similarity: 0.876,
        review_status: 'completed',
        review_model: 'synthetic',
        review: { verdict: 'uncertain', reason_codes: ['pickup_volunteer', 'cost_unknown'] },
        explanations: ['有人明確願意取餐', '實際費用仍待確認'],
      },
    ],
  },
};
const client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: 0 } } });
const refresh = jest.fn<() => Promise<void>>(async () => undefined);
function ui(matches = [a, b], focused = true) {
  return (
    <QueryClientProvider client={client}>
      <StealthSemanticMatches
        key={mockActor}
        matches={matches}
        disabled={false}
        focused={focused}
        now={now}
        refresh={refresh}
        renderMatch={(match, item) => (
          <View key={match.id} testID={`card-${match.id}`}>
            <Text>{match.id}</Text>
            {item ? <StealthSemanticSummary match={match} item={item} /> : null}
          </View>
        )}
      />
    </QueryClientProvider>
  );
}
afterEach(async () => {
  await act(async () => {
    client.clear();
    await new Promise((r) => setTimeout(r, 0));
  });
  jest.clearAllMocks();
  mockActor = 'self';
});

it('calls the model only on explicit action and never consents, changes terms or forms a group', async () => {
  jest.mocked(stealthApi.semantic).mockResolvedValue(data);
  const screen = await render(ui());
  expect(stealthApi.semantic).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'AI 語義排序與判讀' }));
  await waitFor(() => expect(screen.getByText('AI 判讀：資訊不足，仍需確認')).toBeTruthy());
  expect(screen.getByText('• 有人明確願意取餐')).toBeTruthy();
  expect(screen.getByText('• 實際費用仍待確認')).toBeTruthy();
  expect(screen.getByText('語義相似度 0.876（不是成功率）')).toBeTruthy();
  expect(screen.getAllByTestId(/^card-/).map((n) => n.props.testID)).toEqual(['card-b', 'card-a']);
  expect(stealthApi.semantic).toHaveBeenCalledTimes(1);
  expect(stealthApi.consent).not.toHaveBeenCalled();
  expect(stealthApi.terms).not.toHaveBeenCalled();
  expect(stealthApi.decide).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: '回到原配對排序' }));
  expect(screen.queryByTestId('stealth-semantic-b')).toBeNull();
});

it('hides analysis when refreshed terms or consent differ and does not replace the latest match', async () => {
  jest.mocked(stealthApi.semantic).mockResolvedValue(data);
  const screen = await render(ui());
  await fireEvent.press(screen.getByRole('button', { name: 'AI 語義排序與判讀' }));
  await waitFor(() => expect(screen.getByTestId('stealth-semantic-b')).toBeTruthy());
  await screen.rerender(ui([a, { ...b, terms_revision: 1 }]));
  expect(screen.queryByTestId('stealth-semantic-b')).toBeNull();
  expect(screen.getByText(/舊 AI 判讀已隱藏/)).toBeTruthy();
  expect(screen.getAllByTestId(/^card-/).map((n) => n.props.testID)).toEqual(['card-a', 'card-b']);
});

it('retains rule results on model failure with no automatic retry', async () => {
  jest.mocked(stealthApi.semantic).mockRejectedValue(new Error('local_model_busy'));
  const screen = await render(ui());
  await fireEvent.press(screen.getByRole('button', { name: 'AI 語義排序與判讀' }));
  await waitFor(() => expect(screen.getByText('本機模型暫不可用，原配對仍可使用')).toBeTruthy());
  expect(screen.getAllByTestId(/^card-/).map((n) => n.props.testID)).toEqual(['card-a', 'card-b']);
  expect(stealthApi.semantic).toHaveBeenCalledTimes(1);
});

it('ignores a late response after switching accounts', async () => {
  let finish!: (value: StealthSemanticResult) => void;
  jest.mocked(stealthApi.semantic).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const screen = await render(ui());
  await fireEvent.press(screen.getByRole('button', { name: 'AI 語義排序與判讀' }));
  mockActor = 'other';
  await screen.rerender(ui());
  await act(async () => {
    finish(data);
  });
  expect(screen.queryByTestId('stealth-semantic-b')).toBeNull();
  expect(refresh).not.toHaveBeenCalled();
});

it('ignores a late response after going to the background', async () => {
  let finish!: (value: StealthSemanticResult) => void;
  jest.mocked(stealthApi.semantic).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const screen = await render(ui());
  await fireEvent.press(screen.getByRole('button', { name: 'AI 語義排序與判讀' }));
  await screen.rerender(ui([a, b], false));
  await act(async () => {
    finish(data);
  });
  await screen.rerender(ui());
  expect(screen.queryByTestId('stealth-semantic-b')).toBeNull();
  expect(refresh).not.toHaveBeenCalled();
});

it('keeps the unfinished formation editor across ranking changes and foreground transitions', async () => {
  function DraftCard({ id }: { id: string }) {
    const [draft, setDraft] = useState('');
    return <TextInput accessibilityLabel={`draft-${id}`} value={draft} onChangeText={setDraft} />;
  }
  const page = (focused: boolean) => (
    <QueryClientProvider client={client}>
      <StealthSemanticMatches
        matches={[a, b]}
        disabled={false}
        focused={focused}
        now={now}
        refresh={refresh}
        renderMatch={(m) => <DraftCard key={m.id} id={m.id} />}
      />
    </QueryClientProvider>
  );
  jest.mocked(stealthApi.semantic).mockResolvedValue(data);
  const screen = await render(page(true));
  await fireEvent.changeText(screen.getByLabelText('draft-b'), '人工協調中的分工');
  await fireEvent.press(screen.getByRole('button', { name: 'AI 語義排序與判讀' }));
  await waitFor(() => expect(screen.getByText(/已完成語義排序/)).toBeTruthy());
  expect(screen.getByLabelText('draft-b').props.value).toBe('人工協調中的分工');
  await screen.rerender(page(false));
  await screen.rerender(page(true));
  expect(screen.getByLabelText('draft-b').props.value).toBe('人工協調中的分工');
});

it('displays partial review failure without presenting an invented judgment', async () => {
  const partial: StealthSemanticResult = {
    ...data,
    ranking: {
      ...data.ranking,
      warnings: ['invalid_candidate_review'],
      items: [{ ...data.ranking.items[0], review: null, review_status: 'unavailable' }],
    },
  };
  jest.mocked(stealthApi.semantic).mockResolvedValue(partial);
  const screen = await render(ui());
  await fireEvent.press(screen.getByRole('button', { name: 'AI 語義排序與判讀' }));
  await waitFor(() => expect(screen.getByText('AI 候選判讀暫未完成')).toBeTruthy());
  expect(screen.queryByText('AI 判讀：資訊不足，仍需確認')).toBeNull();
  expect(screen.getByText('• 費用待向商家確認')).toBeTruthy();
});

it('does not send a model request when there are no eligible proposals', async () => {
  const screen = await render(ui([{ ...a, status: 'formed' }]));
  await fireEvent.press(screen.getByRole('button', { name: 'AI 語義排序與判讀' }));
  expect(stealthApi.semantic).not.toHaveBeenCalled();
  expect(screen.getByText('先建立需求並找到有效配對，再請分身分析。')).toBeTruthy();
});
