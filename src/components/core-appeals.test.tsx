import { afterEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CoreAppealsScreen } from './core-appeals';
import { api } from '@/lib/api';
jest.mock('@/lib/api', () => ({ api: { get: jest.fn(), post: jest.fn() } }));
jest.mock('@/lib/engagement-api', () => ({ engagementApi: { reports: async () => ({ items: [{ id: 'closed-report', status: 'resolved' }] }) } }));
jest.mock('@/lib/core-api', () => ({ coreError: () => '離線', newRequestKey: () => 'synthetic-appeal-key' }));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), canGoBack: () => false, replace: jest.fn() } }));
jest.mock('@/store/auth-store', () => ({ useAuthStore: Object.assign((select: (s: { user: { id: string } }) => unknown) => select({ user: { id: 'fixture' } }), { getState: () => ({ user: { id: 'fixture' } }) }) }));
jest.mock('@/lib/font-size-storage', () => ({ fontSizeStorage: { getItem: jest.fn(() => null), setItem: jest.fn(), removeItem: jest.fn() } }));
const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } } });
afterEach(async () => { await act(async () => { client.clear(); }); jest.clearAllMocks(); });

it('keeps failed appeal input and retry identity; does not query operator data for ordinary users', async () => {
  jest.mocked(api.get).mockImplementation((async (path: string) => ({ data: path === '/moderation/access' ? { can_review: false } : { items: [] } })) as typeof api.get);
  jest.mocked(api.post).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: { id: 'appeal' } });
  const screen = await render(<QueryClientProvider client={client}><CoreAppealsScreen /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByLabelText('申訴說明 closed-report')).toBeTruthy());
  await act(async () => { await fireEvent.changeText(screen.getByLabelText('申訴說明 closed-report'), '請重新核對這筆隔離測試事件及處置依據。'); });
  await act(async () => { await fireEvent.press(screen.getByRole('button', { name: '送出申訴' })); });
  await waitFor(() => expect(screen.getByText(/說明已保留/)).toBeTruthy());
  const first = jest.mocked(api.post).mock.calls[0];
  await act(async () => { await fireEvent.press(screen.getByRole('button', { name: '送出申訴' })); });
  await waitFor(() => expect(screen.getByText('申訴已儲存，等待管理者覆核。')).toBeTruthy());
  expect(jest.mocked(api.post).mock.calls[1]).toEqual(first);
  expect(jest.mocked(api.get).mock.calls.some(c => c[0] === '/moderation/appeals')).toBe(false);
});
