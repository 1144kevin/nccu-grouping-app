import { afterEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { AgentForm, SignalEditor } from './core-stealth';
import { stealthApi, type StealthAgent } from '@/lib/stealth-api';

jest.mock('expo-router', () => ({ router: {} }));
jest.mock('@/lib/core-api', () => ({ coreError: () => '操作失敗', newRequestKey: () => '11111111-1111-4111-8111-111111111111' }));
jest.mock('@/lib/core-hooks', () => ({ useCoreScreenFocused: () => true }));
jest.mock('@/lib/core-clock', () => ({ useCoreClock: () => ({}) }));
jest.mock('@/lib/stealth-api', () => { const actual = jest.requireActual<typeof import('@/lib/stealth-api')>('@/lib/stealth-api'); return { ...actual, stealthApi: { saveAgent: jest.fn(), create: jest.fn(), draft: jest.fn() } }; });
jest.mock('@/lib/api', () => ({ api: {} }));
jest.mock('@/store/auth-store', () => ({ useAuthStore: Object.assign((select: (state: { user: { id: string } }) => unknown) => select({ user: { id: 'self' } }), { getState: () => ({ user: { id: 'self' } }) }) }));
jest.mock('@/lib/font-size-storage', () => ({ fontSizeStorage: { getItem: jest.fn(() => null), setItem: jest.fn(), removeItem: jest.fn() } }));
const client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: 0 } } });
afterEach(async () => { await act(async () => { client.clear(); await new Promise((resolve) => setTimeout(resolve,0)); }); jest.clearAllMocks(); });

it('does not enable an agent or demo matching without explicit choices', async () => {
  jest.mocked(stealthApi.saveAgent).mockResolvedValue({ user_id:'self', version:1 } as StealthAgent);
  const screen = await render(<QueryClientProvider client={client}><AgentForm initial={null} refresh={async () => undefined} /></QueryClientProvider>);
  await act(async () => { await fireEvent.press(screen.getByRole('button',{ name:'儲存我的分身' })); });
  await waitFor(() => expect(stealthApi.saveAgent).toHaveBeenCalledWith(expect.objectContaining({ enabled:false, include_demo:false, expected_version:0 })));
});

it('retries an uncertain create with the same key and frozen time window', async () => {
  let now = Date.parse('2026-10-16T10:00:00Z');
  jest.mocked(stealthApi.create).mockRejectedValueOnce(new AxiosError('offline')).mockResolvedValueOnce({ matching:'completed',new_matches:1 } as never);
  const screen = await render(<QueryClientProvider client={client}><SignalEditor now={() => now} refresh={async () => undefined} /></QueryClientProvider>);
  await act(async () => { await fireEvent.changeText(screen.getByLabelText('我的需求或計畫（只有自己可見）'),'一起吃晚餐'); });
  await act(async () => { await fireEvent.press(screen.getByRole('button',{name:'確認需求並交給分身'})); });
  await waitFor(() => expect(screen.getByText('操作失敗')).toBeTruthy());
  const first = jest.mocked(stealthApi.create).mock.calls[0];
  now += 10*60000;
  await act(async () => { await fireEvent.press(screen.getByRole('button',{name:'確認需求並交給分身'})); });
  await waitFor(() => expect(screen.getByText(/需求已存入資料庫/)).toBeTruthy());
  expect(jest.mocked(stealthApi.create).mock.calls[1]).toEqual(first);
});
