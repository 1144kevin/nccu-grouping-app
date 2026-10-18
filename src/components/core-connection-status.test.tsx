import { expect, it, jest, afterEach } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { CoreConnectionStatus } from './core-connection-status';
import { api } from '@/lib/api';

jest.mock('@/lib/api', () => ({ api: { get: jest.fn() } }));
jest.mock('@/lib/core-api', () => ({ coreError: () => '暫時無法連線' }));
jest.mock('@/lib/font-size-storage', () => ({
  fontSizeStorage: { getItem: () => null, setItem: jest.fn(), removeItem: jest.fn() },
}));
afterEach(() => {
  jest.clearAllMocks();
});
it('shows only configured capability status and preserves manual fallback', async () => {
  jest.mocked(api.get).mockResolvedValue({
    data: {
      data_mode: 'supabase',
      google_ios_configured: false,
      images_configured: false,
      ai_provider: 'offline_rules',
    },
  });
  const screen = await render(<CoreConnectionStatus />);
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '檢查目前測試連線' }));
  });
  await waitFor(() => expect(screen.getByText(/未連接模型，請用手動需求表單/)).toBeTruthy());
  expect(api.get).toHaveBeenCalledWith('/development/readiness');
});
it('explains offline failures without implying the account was deleted or logged out', async () => {
  jest.mocked(api.get).mockRejectedValue(new Error('offline'));
  const screen = await render(<CoreConnectionStatus />);
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '檢查目前測試連線' }));
  });
  await waitFor(() => expect(screen.getByText(/登入資料不會因此清除/)).toBeTruthy());
});
