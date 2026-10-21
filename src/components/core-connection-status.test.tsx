import { expect, it, jest, afterEach } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { CoreConnectionStatus } from './core-connection-status';
import { api } from '@/lib/api';
import * as appleIntake from '@/lib/apple-intake';
import * as runtime from '@/lib/app-runtime';

jest.mock('@/lib/api', () => ({ api: { get: jest.fn() } }));
jest.mock('@/lib/core-api', () => ({ coreError: () => '暫時無法連線' }));
jest.mock('@/lib/apple-intake', () => ({ __esModule: true, APPLE_INTAKE_ENABLED: false }));
jest.mock('@/lib/app-runtime', () => ({ isExpoGo: jest.fn(() => false) }));
jest.mock('@/lib/font-size-storage', () => ({
  fontSizeStorage: { getItem: () => null, setItem: jest.fn(), removeItem: jest.fn() },
}));
afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  jest.mocked(runtime.isExpoGo).mockReturnValue(false);
});
it('Expo Go never presents configured native OAuth as available', async () => {
  jest.mocked(runtime.isExpoGo).mockReturnValue(true);
  jest.mocked(api.get).mockResolvedValue({ data: {
    data_mode: 'supabase', google_ios_configured: true, images_configured: true,
    ai_provider: 'ollama_local', semantic_configured: true,
  } });
  const screen = await render(<CoreConnectionStatus />);
  await act(async () => { await fireEvent.press(screen.getByRole('button', { name: '檢查目前測試連線' })); });
  await waitFor(() => expect(screen.getByText(/Expo Go 使用信箱登入/)).toBeTruthy());
  expect(screen.getByText(/使用電腦本機模型/)).toBeTruthy();
});
it('distinguishes Apple on-device interviews from backend semantic matching', async () => {
  jest.replaceProperty(appleIntake, 'APPLE_INTAKE_ENABLED', true);
  jest.mocked(api.get).mockResolvedValue({ data: {
    data_mode: 'supabase', google_ios_configured: true, images_configured: true,
    ai_provider: 'offline_rules', semantic_configured: false,
  } });
  const screen = await render(<CoreConnectionStatus />);
  await act(async () => { await fireEvent.press(screen.getByRole('button', { name: '檢查目前測試連線' })); });
  await waitFor(() => expect(screen.getByText(/由 iPhone Apple AI 提供訪談摘要/)).toBeTruthy());
  expect(screen.getByText(/語義配對未啟用/)).toBeTruthy();
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
