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

it('confirms the affected user and points before applying a penalty', async () => {
  jest.mocked(api.get).mockResolvedValueOnce({ data: { items: [{ id: 'report-fixture', status: 'reviewing', review_version: 2,
    payload: { kind: 'user', reason: 'spam', detail: '測試檢舉內容', target_id: 'target-fixture' } }] } });
  jest.mocked(api.get).mockResolvedValue({ data: { available: true, name: '受檢舉使用者', score: 50 } });
  jest.mocked(api.post).mockResolvedValue({ data: { review_version: 3 } });
  const screen = await render(<QueryClientProvider client={client}><CoreModerationScreen /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByText('扣分對象：受檢舉使用者・目前 50 分')).toBeTruthy());
  await fireEvent.changeText(screen.getByLabelText('給回報者的回覆'), '經審核後檢舉成立。');
  await fireEvent.changeText(screen.getByLabelText('扣除信譽積分'), '10');
  await fireEvent.press(screen.getByRole('button', { name: '檢舉成立並結案' }));
  expect(api.post).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: '確認扣分並結案' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/moderation/reports/report-fixture/penalty',
    expect.objectContaining({ points: 10, expected_version: 2, public_response: '經審核後檢舉成立。' })));
});
