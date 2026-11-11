import { afterEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StealthFormation } from './core-stealth-formation';
import { stealthApi, type StealthMatch } from '@/lib/stealth-api';

jest.mock('@/lib/stealth-api', () => ({ stealthApi: { terms: jest.fn() } }));
jest.mock('@/lib/core-api', () => ({ coreError: () => '操作失敗' }));
jest.mock('@/lib/font-size-storage', () => ({ fontSizeStorage: { getItem: jest.fn(() => null), setItem: jest.fn(), removeItem: jest.fn() } }));
const client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: 0 } } });
const now = () => Date.parse('2026-10-18T07:00:00Z');
const match = { id: 'proposal', ends_at: '2026-10-18T11:00:00Z', status: 'ready', member_count: 3, my_member_number: 2, terms_revision: 2, budget_max_twd: 120, terms: { content: '大家一起分享披薩與已協調的費用。', cost_per_person_twd: 150, order_member: 2, pickup_member: 2, deadline_at: '2026-10-19T10:00:00Z' } } as StealthMatch;
afterEach(async () => { await act(async () => { client.clear(); }); jest.clearAllMocks(); });

it('submits negotiated terms beyond the original budget and time, including one buyer and pickup', async () => {
  jest.mocked(stealthApi.terms).mockResolvedValueOnce(match);
  const onSubmitted = jest.fn();
  const screen = await render(<QueryClientProvider client={client}><StealthFormation match={match} now={now} refresh={async () => undefined} onSubmitted={onSubmitted} /></QueryClientProvider>);
  await act(async () => { await fireEvent.press(screen.getByRole('button', { name: '提出方案' })); });
  await waitFor(() => expect(stealthApi.terms).toHaveBeenCalledWith('proposal', 2, expect.objectContaining({ cost_per_person_twd: 150, order_member: 2, pickup_member: 2, deadline_at: '2026-10-19T10:00:00.000Z' })));
  expect(onSubmitted).toHaveBeenCalled();
});

it('preserves the draft when another person changes the revision and prevents overwriting it', async () => {
  const screen = await render(<QueryClientProvider client={client}><StealthFormation match={match} now={now} refresh={async () => undefined} /></QueryClientProvider>);
  await act(async () => { await fireEvent.changeText(screen.getByLabelText('成團公開說明'), '我還沒送出的方案內容需要保留。'); });
  await screen.rerender(<QueryClientProvider client={client}><StealthFormation match={{ ...match, terms_revision: 3 }} now={now} refresh={async () => undefined} /></QueryClientProvider>);
  expect(screen.getByDisplayValue('我還沒送出的方案內容需要保留。')).toBeTruthy();
  expect(screen.getByText('方案已有更新，請先重新載入。')).toBeTruthy();
  await act(async () => { await fireEvent.press(screen.getByRole('button', { name: '提出方案' })); });
  expect(stealthApi.terms).not.toHaveBeenCalled();
});
