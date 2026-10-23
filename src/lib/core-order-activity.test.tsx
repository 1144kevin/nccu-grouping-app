import { afterEach, expect, it, jest } from '@jest/globals';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { coreApi, type CoreOrderActivity } from './core-api';
import { useCoreOrderActivity } from './core-chat-hooks';

jest.mock('./core-api', () => ({
  CORE_API_ENABLED: true,
  CORE_SUPABASE_MODE: true,
  coreApi: { orderActivity: jest.fn(), chatActivity: jest.fn() },
}));
jest.mock('./core-hooks', () => ({ useCoreScreenFocused: () => true }));
jest.mock('./engagement-api', () => ({
  useAccountPreferences: () => ({ data: {} }),
  useInboxPreferences: () => ({ data: { items: [] } }),
  visibleChatActivity: (value: unknown) => value,
}));
jest.mock('@/store/auth-store', () => ({
  useAuthStore: (select: (state: { user: { id: string } }) => unknown) =>
    select({ user: { id: 'viewer' } }),
}));
let client: QueryClient;
afterEach(() => {
  client.clear();
  jest.clearAllMocks();
});
const wrapper = ({ children }: PropsWithChildren) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);
const pending = {
  id: 'older-request',
  post_id: 'older-post',
  post_content: '較早的晚餐團',
  requester_name: '小安',
  kind: 'hosted_request',
  status: 'pending',
  post_cancelled: false,
  post_expired: false,
} as CoreOrderActivity;
it('loads additional activity pages until the badge count has actionable destinations', async () => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  jest
    .mocked(coreApi.chatActivity)
    .mockResolvedValue({ groups: [], total_unread: 0, pending_requests: 1 });
  jest
    .mocked(coreApi.orderActivity)
    .mockResolvedValueOnce({
      items: [{ ...pending, id: 'handled', status: 'accepted' }],
      next_cursor: 'page-2',
    })
    .mockResolvedValueOnce({ items: [pending], next_cursor: null });
  const result = await renderHook(() => useCoreOrderActivity(true), { wrapper });
  await waitFor(() => expect(result.result.current.groups[0]?.postId).toBe('older-post'));
  expect(coreApi.orderActivity).toHaveBeenNthCalledWith(2, 'page-2');
});
it('does not fetch the full history once all pending requests are already visible', async () => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  jest
    .mocked(coreApi.chatActivity)
    .mockResolvedValue({ groups: [], total_unread: 0, pending_requests: 1 });
  jest
    .mocked(coreApi.orderActivity)
    .mockResolvedValue({ items: [pending], next_cursor: 'unneeded-history' });
  const result = await renderHook(() => useCoreOrderActivity(true), { wrapper });
  await waitFor(() => expect(result.result.current.groups).toHaveLength(1));
  expect(coreApi.orderActivity).toHaveBeenCalledTimes(1);
});
