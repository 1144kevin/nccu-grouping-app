import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { AdvancedStealthScreen as CoreStealthScreen } from './core-stealth';
import { queryClient } from '@/lib/query-client';
import { stealthApi, type StealthAgent } from '@/lib/stealth-api';

jest.mock('expo-router', () => ({ router: {} }));
jest.mock('@/lib/api', () => ({ api: {} }));
jest.mock('@/lib/core-api', () => ({ coreError: () => '連線失敗', newRequestKey: () => 'test-key' }));
jest.mock('@/lib/core-hooks', () => ({ useCoreScreenFocused: () => true }));
jest.mock('@/lib/query-client', () => {
  const { QueryClient } = jest.requireActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return { queryClient: new QueryClient() };
});
const mockClockRetry = jest.fn();
let mockHasClock = true;
jest.mock('@/lib/core-clock', () => ({ useCoreClock: () => ({
  data: mockHasClock ? { driftMs: 0 } : undefined,
  error: mockHasClock ? null : new Error('offline'),
  refetch: mockClockRetry,
  now: () => Date.parse('2026-10-22T10:00:00Z'),
}) }));
jest.mock('@/lib/stealth-api', () => {
  const actual = jest.requireActual<typeof import('@/lib/stealth-api')>('@/lib/stealth-api');
  return { ...actual, stealthApi: { agent: jest.fn(), signals: jest.fn(), matches: jest.fn(), saveAgent: jest.fn(), run: jest.fn(), discover: jest.fn(), semantic: jest.fn() } };
});
jest.mock('@/store/auth-store', () => ({ useAuthStore: Object.assign(
  (select: (state: { user: { id: string } }) => unknown) => select({ user: { id: 'self' } }),
  { getState: () => ({ user: { id: 'self' } }) },
) }));
jest.mock('@/lib/font-size-storage', () => ({ fontSizeStorage: { getItem: jest.fn(() => null), setItem: jest.fn(), removeItem: jest.fn() } }));

const paused = { user_id: 'self', name: '我的分身', enabled: false, version: 1,
  daily_invite_limit: 3, timezone: 'Asia/Taipei', quiet_start_hour: null,
  quiet_end_hour: null, avatar_key: 'cat', tone: 'warm', exploration: 'balanced', include_demo: false,
} as StealthAgent;

beforeEach(() => {
  queryClient.setDefaultOptions({ queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } });
  jest.mocked(stealthApi.agent).mockResolvedValue(paused);
  jest.mocked(stealthApi.signals).mockResolvedValue({ items: [] } as never);
  jest.mocked(stealthApi.matches).mockResolvedValue({ items: [] } as never);
  mockHasClock = true;
});
afterEach(async () => {
  await act(async () => { queryClient.clear(); });
  jest.resetAllMocks();
});

async function results() {
  const screen = await render(<QueryClientProvider client={queryClient}><CoreStealthScreen /></QueryClientProvider>);
  await fireEvent.press(screen.getByRole('button', { name: '偷揪結果' }));
  return screen;
}

it('explains a paused agent and opens settings without enabling it automatically', async () => {
  const screen = await results();
  await waitFor(() => expect(screen.getByText('你的分身目前已暫停')).toBeTruthy());
  expect(screen.getByRole('button', { name: '讓分身找機會' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'AI 搜尋新配對機會' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'AI 語義排序與判讀' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: '前往設定並啟用分身' }));
  expect(screen.getByRole('checkbox', { name: '開啟偷揪，允許依已確認需求尋找機會' })).not.toBeChecked();
  expect(stealthApi.saveAgent).not.toHaveBeenCalled();
});

it('requires an explicit choice AND save before unlocking discovery, with analysis waiting for matches', async () => {
  jest.mocked(stealthApi.saveAgent).mockImplementation(async () => {
    const enabled = { ...paused, enabled: true, version: 2 };
    jest.mocked(stealthApi.agent).mockResolvedValue(enabled);
    return enabled;
  });
  const screen = await results();
  await waitFor(() => expect(screen.getByText('你的分身目前已暫停')).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: '前往設定並啟用分身' }));
  await fireEvent.press(screen.getByRole('checkbox', { name: '開啟偷揪，允許依已確認需求尋找機會' }));
  expect(screen.getByText(/啟用狀態尚未儲存/)).toBeTruthy();
  expect(stealthApi.saveAgent).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: '儲存我的分身' }));
  await waitFor(() => expect(screen.getByText('已儲存狀態：偷揪已啟用。')).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: '偷揪結果' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '讓分身找機會' })).toBeEnabled());
  expect(screen.getByRole('button', { name: 'AI 搜尋新配對機會' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'AI 語義排序與判讀' })).toBeDisabled();
  expect(stealthApi.run).not.toHaveBeenCalled();
  expect(stealthApi.discover).not.toHaveBeenCalled();
  expect(stealthApi.semantic).not.toHaveBeenCalled();
});

it('distinguishes a failed load from a disabled agent and recovers through retry', async () => {
  jest.mocked(stealthApi.agent).mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ ...paused, enabled: true });
  const screen = await results();
  await waitFor(() => expect(screen.getByText('無法確認已儲存的分身設定，請重試載入。')).toBeTruthy());
  expect(screen.queryByText('你的分身目前已暫停')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: '重試載入分身' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'AI 搜尋新配對機會' })).toBeEnabled());
});

it('offers a server-clock retry without disabling rule matching', async () => {
  mockHasClock = false;
  jest.mocked(stealthApi.agent).mockResolvedValue({ ...paused, enabled: true });
  const screen = await results();
  await waitFor(() => expect(screen.getByRole('button', { name: '讓分身找機會' })).toBeEnabled());
  expect(screen.getByRole('button', { name: 'AI 搜尋新配對機會' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: '重試取得時間' }));
  expect(mockClockRetry).toHaveBeenCalledTimes(1);
});
