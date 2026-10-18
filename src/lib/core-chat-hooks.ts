import { useQuery } from '@tanstack/react-query';
import { CORE_API_ENABLED, CORE_SUPABASE_MODE, coreApi } from './core-api';
import { useAuthStore } from '@/store/auth-store';
import { useAccountPreferences, useInboxPreferences, visibleChatActivity } from './engagement-api';

export function useCoreChatActivity(polling = true) {
  const user = useAuthStore((state) => state.user);
  const preferences=useAccountPreferences();
  const inbox=useInboxPreferences();
  const query=useQuery({
    queryKey: ['core', user?.id, 'chat-activity'],
    queryFn: coreApi.chatActivity,
    enabled: CORE_API_ENABLED && CORE_SUPABASE_MODE && !!user,
    refetchInterval: polling ? 15_000 : false,
  });
  return {...query,data:query.data&&preferences.data&&inbox.data?visibleChatActivity(query.data,inbox.data.items,preferences.data):undefined};
}
