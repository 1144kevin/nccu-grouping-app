import { afterEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, type AxiosResponse } from 'axios';
import { CoreGroupChat } from './core-chat';
import { coreApi, type CoreChatPage } from '@/lib/core-api';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/lib/core-hooks', () => ({ useCoreScreenFocused: () => true, invalidateCore: jest.fn(async () => undefined) }));
jest.mock('@/lib/core-api', () => ({ coreApi: { messages: jest.fn(), sendMessage: jest.fn(), readChat: jest.fn(async () => ({ ok: true })) }, coreError: () => '操作失敗', newRequestKey: jest.fn(() => 'synthetic-message-retry-key') }));
jest.mock('@/store/auth-store', () => ({ useAuthStore: (selector: (state: { user: { id: string } }) => unknown) => selector({ user: { id: 'member' } }) }));
jest.mock('@/lib/font-size-storage', () => ({ fontSizeStorage: { getItem: jest.fn(() => null), setItem: jest.fn(), removeItem: jest.fn() } }));

const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } } });
const page: CoreChatPage = {
  post: { id: 'post-a', author_id: 'host', author_name: '主揪', content: '一起訂晚餐', tags: ['晚餐'], location: { name: '校門', latitude: 24.9, longitude: 121.5 }, price_per_person: null, deadline_at: '2026-10-20T10:00:00Z', capacity: 3, joined: 2, status: 'open', my_status: 'accepted', created_at: '2026-10-17T08:00:00Z' },
  messages: [{ id: 'message-a', post_id: 'post-a', sender_id: 'host', sender_name: '主揪', sender_badge: '🍱', content: '六點見。', created_at: '2026-10-17T08:00:00Z' }], next_cursor: null, can_send: true,
};

afterEach(async () => { await act(async () => { client.clear(); await new Promise((resolve) => setTimeout(resolve, 0)); }); jest.clearAllMocks(); });

it('keeps a failed draft and retries it with the same idempotency key', async () => {
  jest.mocked(coreApi.messages).mockResolvedValue(page);
  jest.mocked(coreApi.sendMessage).mockRejectedValueOnce(new AxiosError('offline')).mockResolvedValue(page.messages[0]);
  const screen = await render(<QueryClientProvider client={client}><CoreGroupChat id="post-a" /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByText('六點見。')).toBeTruthy());
  await act(async () => { await fireEvent.changeText(screen.getByLabelText('聊天訊息'), '  收到，謝謝。  '); });
  await act(async () => { await fireEvent.press(screen.getByRole('button', { name: '傳送' })); });
  await waitFor(() => expect(screen.getByText(/內容已保留/)).toBeTruthy());
  expect(screen.getByLabelText('聊天訊息').props.value).toBe('  收到，謝謝。  ');
  await act(async () => { await fireEvent.press(screen.getByRole('button', { name: '傳送' })); });
  await waitFor(() => expect(screen.getByLabelText('聊天訊息').props.value).toBe(''));
  expect(coreApi.sendMessage).toHaveBeenNthCalledWith(1, 'post-a', '收到，謝謝。', 'synthetic-message-retry-key');
  expect(coreApi.sendMessage).toHaveBeenNthCalledWith(2, 'post-a', '收到，謝謝。', 'synthetic-message-retry-key');
});

it('renders cancelled chat as read-only', async () => {
  jest.mocked(coreApi.messages).mockResolvedValue({ ...page, can_send: false, post: { ...page.post, status: 'cancelled' } });
  const screen = await render(<QueryClientProvider client={client}><CoreGroupChat id="post-a" /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByText('拼單已取消，聊天室只供查看紀錄。')).toBeTruthy());
  expect(screen.queryByLabelText('聊天訊息')).toBeNull();
  expect(coreApi.sendMessage).not.toHaveBeenCalled();
});

it('hides private messages when membership is denied', async () => {
  const response = { status: 403 } as AxiosResponse;
  jest.mocked(coreApi.messages).mockRejectedValue(new AxiosError('denied', 'ERR_BAD_REQUEST', undefined, undefined, response));
  const screen = await render(<QueryClientProvider client={client}><CoreGroupChat id="post-a" /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByText('操作失敗')).toBeTruthy());
  expect(screen.queryByText('六點見。')).toBeNull();
  expect(screen.queryByLabelText('聊天訊息')).toBeNull();
});
