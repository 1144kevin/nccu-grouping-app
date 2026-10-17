import { useQuery } from '@tanstack/react-query';
import { CORE_API_ENABLED, coreApi } from './core-api';
import { useAuthStore } from '@/store/auth-store';
import { useCoreScreenFocused } from './core-hooks';
import { monotonicNow, serverClockAnchor, serverClockNow } from './server-clock';

export function useCoreClock() {
  const user = useAuthStore((state) => state.user);
  const focused = useCoreScreenFocused();
  const query = useQuery({
    queryKey: ['core', user?.id, 'clock'],
    queryFn: async () => serverClockAnchor((await coreApi.clock()).server_time, monotonicNow(), Date.now()),
    enabled: CORE_API_ENABLED && !!user && focused, staleTime: 30_000, refetchOnWindowFocus: 'always',
  });
  return { ...query, now: () => query.data ? serverClockNow(query.data, monotonicNow()) : Date.now() };
}
