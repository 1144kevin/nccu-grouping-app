import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { CORE_API_ENABLED, CORE_SUPABASE_MODE } from '@/lib/core-api';
import { useAuthStore } from '@/store/auth-store';

export type PenaltyNotice = {
  id: string;
  points: number;
  created_at: string;
  read_at: string | null;
  response: string;
};

export function usePenaltyNotices() {
  const actor = useAuthStore((state) => state.user?.id);
  return useQuery({
    queryKey: ['core', actor, 'penalty-notices'],
    queryFn: async () =>
      (await api.get<{ items: PenaltyNotice[] }>('/notifications/penalties')).data,
    enabled: !!actor && CORE_API_ENABLED && CORE_SUPABASE_MODE,
    refetchInterval: 15000,
    retry: false,
  });
}
