import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { createElement, type ReactNode } from 'react';
import { Platform } from 'react-native';

const mockGet = jest.fn<() => Promise<{ data: unknown }>>();
jest.mock('@/lib/api', () => ({ api: { get: () => mockGet() } }));
jest.mock('@/lib/core-api', () => ({ CORE_API_ENABLED: true, CORE_SUPABASE_MODE: true }));
jest.mock('@/store/auth-store', () => ({
  useAuthStore: (select: (s: { user: { id: string } }) => unknown) => select({ user: { id: 'u1' } }),
}));

import { useNotificationBadge } from './notification-badge';

function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

describe('useNotificationBadge', () => {
  const setAppBadge = jest.fn(async () => undefined);
  const clearAppBadge = jest.fn(async () => undefined);

  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as { OS: string }).OS = 'web';
    Object.defineProperty(globalThis, 'navigator', {
      value: { setAppBadge, clearAppBadge },
      configurable: true,
    });
  });

  it('excludes unread chat messages and clears the web app badge when orders and penalties are zero', async () => {
    mockGet.mockResolvedValueOnce({
      data: { total: 3, messages: 3, orders: 0, penalties: 0 },
    });
    const { result } = await renderHook(() => useNotificationBadge(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.count).toBe(0);
    expect(clearAppBadge).toHaveBeenCalledTimes(1);
    expect(setAppBadge).not.toHaveBeenCalled();
  });

  it('counts orders and penalties and syncs the web app badge', async () => {
    mockGet.mockResolvedValueOnce({
      data: { total: 5, messages: 2, orders: 2, penalties: 1 },
    });
    const { result } = await renderHook(() => useNotificationBadge(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.count).toBe(3);
    expect(setAppBadge).toHaveBeenCalledWith(3);
    expect(clearAppBadge).not.toHaveBeenCalled();
  });
});
