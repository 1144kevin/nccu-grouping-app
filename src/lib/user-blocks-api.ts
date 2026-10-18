import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { useCoreScreenFocused } from './core-hooks';
import { useAuthStore } from '@/store/auth-store';

export type BlockedUser = { user_id: string; display_name: string; created_at: string };
export const userBlocksApi = {
  blocks: async () => (await api.get<{ items: BlockedUser[] }>('/account/blocks')).data,
  block: async (id: string) =>
    (
      await api.put<{ user_id: string; blocked: boolean }>(
        `/account/blocks/${encodeURIComponent(id)}`,
      )
    ).data,
  unblock: async (id: string) =>
    (
      await api.delete<{ user_id: string; blocked: boolean }>(
        `/account/blocks/${encodeURIComponent(id)}`,
      )
    ).data,
};
export function useBlockedUsers() {
  const actor = useAuthStore((s) => s.user?.id);
  const focused = useCoreScreenFocused();
  return useQuery({
    queryKey: ['core', actor, 'blocks'],
    queryFn: userBlocksApi.blocks,
    enabled: !!actor && focused,
    retry: false,
  });
}
