import { useEffect } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { CORE_API_ENABLED, CORE_SUPABASE_MODE, coreApi } from './core-api';
import { useAuthStore } from '@/store/auth-store';
import { useAccountPreferences, useInboxPreferences, visibleChatActivity } from './engagement-api';
import { useCoreScreenFocused } from './core-hooks';
import { pendingOrderGroups } from './order-attention';

export function useCoreChatActivity(polling = true) {
  const user = useAuthStore((state) => state.user);
  const preferences = useAccountPreferences();
  const inbox = useInboxPreferences();
  const query = useQuery({
    queryKey: ['core', user?.id, 'chat-activity'],
    queryFn: coreApi.chatActivity,
    enabled: CORE_API_ENABLED && CORE_SUPABASE_MODE && !!user,
    refetchInterval: polling ? 15_000 : false,
  });
  return {
    ...query,
    rawData: query.data,
    data:
      query.data && preferences.data && inbox.data
        ? visibleChatActivity(query.data, inbox.data.items, preferences.data)
        : undefined,
  };
}

export function useCoreOrderActivity(loadPending = false) {
  const user = useAuthStore((state) => state.user);
  const focused = useCoreScreenFocused();
  const activity = useCoreChatActivity(false);
  const query = useInfiniteQuery({
    queryKey: ['core', user?.id, 'order-activity'],
    queryFn: ({ pageParam }) => coreApi.orderActivity(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    enabled: CORE_API_ENABLED && CORE_SUPABASE_MODE && !!user && focused,
    refetchInterval: focused ? 15_000 : false,
  });
  const byId = new Map<
    string,
    Awaited<ReturnType<typeof coreApi.orderActivity>>['items'][number]
  >();
  for (const item of query.data?.pages.flatMap((page) => page.items) ?? []) {
    if (!byId.has(item.id)) byId.set(item.id, item);
  }
  const items = [...byId.values()];
  const groups = pendingOrderGroups(items);
  const found = groups.reduce((sum, group) => sum + group.count, 0);
  const total = activity.rawData?.pending_requests ?? found;
  const { hasNextPage, isFetching, isFetchNextPageError, fetchNextPage } = query;
  useEffect(() => {
    if (
      loadPending &&
      focused &&
      found < total &&
      hasNextPage &&
      !isFetching &&
      !isFetchNextPageError
    )
      void fetchNextPage();
  }, [
    loadPending,
    focused,
    found,
    total,
    hasNextPage,
    isFetching,
    isFetchNextPageError,
    fetchNextPage,
  ]);
  return { ...query, items, groups, pendingCount: Math.max(total, found) };
}
