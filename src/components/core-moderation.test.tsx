import { afterEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CoreModerationScreen } from './core-moderation';
import { api } from '@/lib/api';
jest.mock('@/lib/api', () => ({ api: { get: jest.fn(), post: jest.fn() } }));
jest.mock('@/lib/core-api', () => ({ coreError: () => '此帳號沒有回報查核權限。', newRequestKey: () => 'synthetic-review-key' }));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), canGoBack: () => false, replace: jest.fn() } }));
jest.mock('@/store/auth-store', () => ({ useAuthStore: (select: (s: { user: { id: string } }) => unknown) => select({ user: { id: 'operator-fixture' } }) }));
jest.mock('@/lib/font-size-storage', () => ({ fontSizeStorage: { getItem: jest.fn(() => null), setItem: jest.fn(), removeItem: jest.fn() } }));
const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } } });
afterEach(async () => { await act(async () => { client.clear(); }); jest.clearAllMocks(); });

it('offers no review controls when the backend denies operator access', async () => {
  jest.mocked(api.get).mockRejectedValueOnce(new Error('moderator_required'));
  const screen = await render(<QueryClientProvider client={client}><CoreModerationScreen /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByText('此帳號沒有回報查核權限。')).toBeTruthy());
  expect(screen.queryByLabelText('給回報者的回覆')).toBeNull();
  expect(api.post).not.toHaveBeenCalled();
});

it('requires a reason and a second explicit confirmation before cancelling a reported post', async () => {
  jest.mocked(api.get).mockResolvedValueOnce({ data: { items: [{ id: 'report-fixture', status: 'reviewing', review_version: 2,
    payload: { kind: 'post', reason: 'spam', detail: '隔離檢舉，不能自動取消拼單。', target_id: 'post-fixture' } }] } });
  jest.mocked(api.post).mockResolvedValueOnce({ data: { review_version: 3 } });
  const screen = await render(<QueryClientProvider client={client}><CoreModerationScreen /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByLabelText('給回報者的回覆')).toBeTruthy());
  await act(async () => { await fireEvent.changeText(screen.getByLabelText('給回報者的回覆'), '已查核並取消該筆測試拼單。'); });
  await act(async () => { await fireEvent.press(screen.getByRole('button', { name: '取消被檢舉拼單…' })); });
  expect(api.post).not.toHaveBeenCalled();
  await act(async () => { await fireEvent.press(screen.getByRole('button', { name: '確認取消這筆拼單並結案' })); });
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/moderation/reports/report-fixture/review', expect.objectContaining({ action: 'cancel_post', expected_version: 2, public_response: '已查核並取消該筆測試拼單。', request_key: 'synthetic-review-key' })));
});
