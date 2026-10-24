import { afterEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StealthReplySuggestions } from './stealth-reply-suggestions';
import { stealthApi } from '@/lib/stealth-api';

jest.mock('@/lib/stealth-api', () => ({ stealthApi: { replySuggestions: jest.fn(), roomSend: jest.fn() } }));
jest.mock('@/lib/font-size-storage', () => ({ fontSizeStorage: { getItem: jest.fn(() => null), setItem: jest.fn(), removeItem: jest.fn() } }));
const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
const replies = { suggestions: ['想先確認優惠適用哪些品項？', '你方便在哪裡交接？', '費用要不要先對一下？'], context_key: 'snapshot', is_llm: true };
afterEach(async () => { await act(async () => { client.clear(); }); jest.clearAllMocks(); });

it('offers three editable replies and refreshes a batch without sending', async () => {
  jest.mocked(stealthApi.replySuggestions).mockResolvedValue(replies);
  const choose = jest.fn();
  const screen = await render(<QueryClientProvider client={client}><StealthReplySuggestions id="room" actor="me" contextKey="initial" enabled disabled={false} onSelect={choose} /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByText(replies.suggestions[0])).toBeTruthy(), { timeout: 2500 });
  await act(async () => { await fireEvent.press(screen.getByRole('button', { name: `使用建議 1：${replies.suggestions[0]}` })); });
  expect(choose).toHaveBeenCalledWith(replies.suggestions[0]);
  expect(stealthApi.roomSend).not.toHaveBeenCalled();
  jest.mocked(stealthApi.replySuggestions).mockResolvedValueOnce({ ...replies, suggestions: ['誰方便取餐呢？', '我們先確認份量好嗎？', '你偏好什麼時間？'] });
  await act(async () => { await fireEvent.press(screen.getByRole('button', { name: '換一批回覆建議' })); });
  await waitFor(() => expect(screen.getByText('誰方便取餐呢？')).toBeTruthy());
  expect(stealthApi.replySuggestions).toHaveBeenLastCalledWith('room', 1, expect.anything(), replies.suggestions);
});

it('discards an old in-flight reply when a newer chat snapshot arrives', async () => {
  let finish: (value: typeof replies) => void = () => undefined;
  jest.mocked(stealthApi.replySuggestions).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const choose = jest.fn();
  const view = (context: string) => <QueryClientProvider client={client}><StealthReplySuggestions key={context} id="room" actor="me" contextKey={context} enabled disabled={false} onSelect={choose} /></QueryClientProvider>;
  const screen = await render(view('old'));
  await waitFor(() => expect(stealthApi.replySuggestions).toHaveBeenCalledTimes(1), { timeout: 2500 });
  jest.mocked(stealthApi.replySuggestions).mockResolvedValueOnce({ ...replies, suggestions: ['剛剛提到的交接點在哪裡？', '要不要確認分攤方式？', '品項還需要補充嗎？'] });
  await screen.rerender(view('new'));
  await act(async () => { finish(replies); });
  expect(screen.queryByText(replies.suggestions[0])).toBeNull();
  await waitFor(() => expect(screen.getByText('剛剛提到的交接點在哪裡？')).toBeTruthy(), { timeout: 2500 });
  expect(choose).not.toHaveBeenCalled();
});

it('does not request AI while unfocused and keeps manual chat usable after failure', async () => {
  jest.mocked(stealthApi.replySuggestions).mockRejectedValueOnce(new Error('rate_limit'));
  const view = (enabled: boolean) => <QueryClientProvider client={client}><StealthReplySuggestions id="room" actor="me" contextKey="latest" enabled={enabled} disabled={false} onSelect={jest.fn()} /></QueryClientProvider>;
  const screen = await render(view(false));
  expect(stealthApi.replySuggestions).not.toHaveBeenCalled();
  await screen.rerender(view(true));
  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy(), { timeout: 2500 });
  expect(screen.getByText('建議暫時無法更新，請換一批重試；仍可自行輸入訊息。')).toBeTruthy();
});
