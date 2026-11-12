import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { CORE_API_ENABLED, CORE_SUPABASE_MODE } from '@/lib/core-api';
import { stealthApi } from '@/lib/stealth-api';
import { selectUnreadNotificationCount, useAppStore } from '@/store/app-store';
import { useAuthStore } from '@/store/auth-store';

export type NotificationBadge = {
  total: number;
  messages: number;
  orders: number;
  penalties: number;
};

export function useNotificationBadge() {
  const actor = useAuthStore((state) => state.user?.id);
  const demoCount = useAppStore(selectUnreadNotificationCount);
  const cloud = CORE_API_ENABLED && CORE_SUPABASE_MODE;
  const query = useQuery({
    queryKey: ['core', actor, 'notification-badge'],
    queryFn: async () => (await api.get<NotificationBadge>('/notifications/unread')).data,
    enabled: cloud && !!actor,
    refetchInterval: 15000,
    retry: 2,
    refetchOnWindowFocus: 'always',
  });
  return { ...query, count: cloud ? (query.data?.total ?? 0) : demoCount };
}

export function useStealthBadge() {
  const actor = useAuthStore((state) => state.user?.id);
  const cloud = CORE_API_ENABLED && CORE_SUPABASE_MODE;
  const query = useQuery({
    queryKey: ['core', actor, 'stealth', 'matches'],
    queryFn: stealthApi.matches,
    enabled: cloud && !!actor,
    refetchInterval: 15000,
    retry: 1,
    refetchOnWindowFocus: 'always',
  });
  const count = cloud
    ? (query.data?.items.filter(
        (m) =>
          (m.status === 'pending' && m.my_decision === 'pending') ||
          (m.status === 'ready' && !m.coordination_opened),
      ).length ?? 0)
    : 0;
  return { ...query, count };
}
