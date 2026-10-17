import { useQuery } from '@tanstack/react-query';
import { CORE_API_ENABLED, CORE_SUPABASE_MODE, coreApi } from './core-api';
import { useAuthStore } from '@/store/auth-store';

export function useCoreChatActivity(polling = true) {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: ['core', user?.id, 'chat-activity'],
    queryFn: coreApi.chatActivity,
    enabled: CORE_API_ENABLED && CORE_SUPABASE_MODE && !!user,
    refetchInterval: polling ? 15_000 : false,
  });
}
