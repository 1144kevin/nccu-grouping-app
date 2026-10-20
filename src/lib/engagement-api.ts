import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { api } from '@/lib/api';
import { CORE_API_ENABLED, CORE_SUPABASE_MODE } from '@/lib/core-api';
import { useAuthStore } from '@/store/auth-store';
import type { CorePost, CorePostPage } from '@/lib/core-api';
import { useCoreScreenFocused } from '@/lib/core-hooks';

export type NotificationPreferences = {
  joinRequests: boolean;
  messages: boolean;
  recommendations: boolean;
  deadlineReminders: boolean;
  stealthInvites: boolean;
};
export type AccountPreferences = {
  notifications: NotificationPreferences;
  preferred_tags: string[];
  version: number;
};
export type InboxPreference = { post_id: string; muted: boolean; archived: boolean };
export type SavedPostPreference = {
  post_id: string;
  hidden: boolean;
  reminder: boolean;
  reminder_at: string;
  deadline_at: string;
  post_content: string;
  status: 'scheduled' | 'due' | 'expired' | 'cancelled';
};
export type ReportInput = {
  kind: 'feedback' | 'post' | 'message' | 'user';
  target_id: string | null;
  reason: 'other' | 'spam' | 'harassment' | 'inappropriate' | 'fraud';
  detail: string;
  platform: 'web' | 'ios' | 'android' | 'unknown';
  app_version: string;
};
export type Report = ReportInput & { id: string; status: 'received' | 'reviewing' | 'resolved' | 'dismissed'; created_at: string; public_response?: string; review_version?: number };
export const engagementApi = {
  preferences: async () => (await api.get<AccountPreferences>('/account/preferences')).data,
  savePreferences: async (value: Omit<AccountPreferences, 'version'>, expected_version: number) =>
    (await api.put<AccountPreferences>('/account/preferences', { value, expected_version })).data,
  inbox: async () => (await api.get<{ items: InboxPreference[] }>('/account/inbox')).data,
  saveInbox: async (postId: string, value: Omit<InboxPreference, 'post_id'>) =>
    (await api.put<InboxPreference>(`/account/inbox/${encodeURIComponent(postId)}`, value)).data,
  reports: async () => (await api.get<{ items: Report[] }>('/reports')).data,
  report: async (value: ReportInput, key: string) =>
    (await api.post<Report>('/reports', value, { headers: { 'Idempotency-Key': key } })).data,
  recommendations: async (cursor?: string) =>
    (await api.get<CorePostPage>('/recommendations', { params: { limit: 30, cursor } })).data,
  savedPosts: async () =>
    (await api.get<{ items: SavedPostPreference[] }>('/account/saved-posts')).data,
  savePost: async (id: string, value: { hidden: boolean; reminder: boolean }) =>
    (await api.put<SavedPostPreference>(`/account/saved-posts/${encodeURIComponent(id)}`, value))
      .data,
};
export function useAccountPreferences() {
  const id = useAuthStore((state) => state.user?.id);
  return useQuery({
    queryKey: ['core', id, 'preferences'],
    queryFn: engagementApi.preferences,
    enabled: CORE_API_ENABLED && CORE_SUPABASE_MODE && !!id,
    refetchOnWindowFocus: false,
  });
}
export function useInboxPreferences() {
  const id = useAuthStore((state) => state.user?.id);
  return useQuery({
    queryKey: ['core', id, 'inbox-preferences'],
    queryFn: engagementApi.inbox,
    enabled: CORE_API_ENABLED && CORE_SUPABASE_MODE && !!id,
    refetchOnWindowFocus: false,
  });
}
export function useCoreRecommendations(active: boolean) {
  const id = useAuthStore((state) => state.user?.id);
  const focused = useCoreScreenFocused();
  const preferences = useAccountPreferences();
  const query = useInfiniteQuery({
    queryKey: ['core', id, 'recommendations', preferences.data?.version],
    retry: (count, error) => !(isAxiosError(error) && error.response?.status === 409) && count < 1,
    queryFn: ({ pageParam }) => engagementApi.recommendations(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    enabled:
      active && focused && CORE_API_ENABLED && CORE_SUPABASE_MODE && !!id && !!preferences.data,
    refetchInterval: 10_000,
  });
  return {
    ...query,
    posts: recommendationCandidates(query.data?.pages.flatMap((page) => page.items) ?? []),
    error: preferences.error ?? query.error,
    isPending: !preferences.error && (preferences.isPending || query.isPending),
    refetch: async () => {
      await preferences.refetch();
      return query.refetch();
    },
  };
}

export function recommendationCandidates(posts: CorePost[]): CorePost[] {
  // Defensive display filter also works before the reviewed SQL upgrade is applied.
  // Admission still uses the authoritative server transaction.
  return posts.filter((post) => post.status === 'open' && post.joined < post.capacity);
}
export function useSavedPostPreferences() {
  const id = useAuthStore((state) => state.user?.id);
  const focused = useCoreScreenFocused();
  return useQuery({
    queryKey: ['core', id, 'saved-posts'],
    queryFn: engagementApi.savedPosts,
    enabled: CORE_API_ENABLED && CORE_SUPABASE_MODE && !!id && focused,
    refetchInterval: 15_000,
  });
}
export function visibleChatActivity<
  T extends {
    groups: { post_id: string; unread_count: number }[];
    total_unread: number;
    pending_requests: number;
  },
>(value: T, inbox: InboxPreference[], preferences?: AccountPreferences): T {
  const hidden = new Set(
    inbox.filter((item) => item.muted || item.archived).map((item) => item.post_id),
  );
  const groups =
    preferences?.notifications.messages === false
      ? []
      : value.groups.filter((group) => !hidden.has(group.post_id));
  return {
    ...value,
    groups,
    total_unread: groups.reduce((sum, group) => sum + group.unread_count, 0),
    pending_requests:
      preferences?.notifications.joinRequests === false ? 0 : value.pending_requests,
  };
}
