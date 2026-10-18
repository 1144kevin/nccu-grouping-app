import { afterEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReportComposer } from './core-reports';
import { engagementApi, type Report } from '@/lib/engagement-api';
jest.mock('@/lib/engagement-api', () => ({ engagementApi: { report: jest.fn() } }));
jest.mock('@/lib/core-api', () => ({
  coreError: () => '暫時無法連線',
  newRequestKey: () => 'synthetic-report-retry-key',
}));
jest.mock('@/store/auth-store', () => ({
  useAuthStore: Object.assign(
    (select: (state: { user: { id: string } }) => unknown) => select({ user: { id: 'fixture' } }),
    { getState: () => ({ user: { id: 'fixture' } }) },
  ),
}));
jest.mock('@/lib/font-size-storage', () => ({
  fontSizeStorage: { getItem: jest.fn(() => null), setItem: jest.fn(), removeItem: jest.fn() },
}));
const client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: 0 } } });
afterEach(async () => {
  await act(async () => {
    client.clear();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  jest.clearAllMocks();
});
it('does not display success until saved, retains failed text and reuses the retry key', async () => {
  jest
    .mocked(engagementApi.report)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ id: 'fixture-report', status: 'received' } as Report);
  const screen = await render(
    <QueryClientProvider client={client}>
      <ReportComposer kind="feedback" />
    </QueryClientProvider>,
  );
  await act(async () => {
    await fireEvent.changeText(
      screen.getByLabelText('回報說明'),
      '我遇到明確的操作問題，這是隔離測試內容。',
    );
  });
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '確認送出回報' }));
  });
  await waitFor(() => expect(screen.getByText(/內容已保留/)).toBeTruthy());
  expect(screen.queryByText(/已儲存並收到/)).toBeNull();
  const first = jest.mocked(engagementApi.report).mock.calls[0];
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '確認送出回報' }));
  });
  await waitFor(() => expect(screen.getByText(/已儲存並收到，尚待管理者查看/)).toBeTruthy());
  expect(jest.mocked(engagementApi.report).mock.calls[1]).toEqual(first);
});
