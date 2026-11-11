import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { CORE_API_ENABLED, CORE_SUPABASE_MODE, type CorePost } from '@/lib/core-api';
import { useCoreScreenFocused } from '@/lib/core-hooks';
import { useAuthStore } from '@/store/auth-store';
import { runPostWritingJob, type WritingOptions } from '@/lib/post-writing-job';

export type ThreadKind = 'group' | 'direct' | 'stealth';
export type InboxFilter = 'all' | 'primary' | 'group' | 'direct';
export type ThreadMessage = {
  image_id?: string | null;
  id: string;
  thread_id?: string;
  sender_id: string | null;
  sender_name: string;
  sender_badge: string;
  sender_level?: number;
  content: string;
  created_at: string;
};
export type InboxAvatarMember = { id: string; name: string; badge: string };
type ThreadBase = {
  avatar_members?: InboxAvatarMember[];
  id: string;
  peer_id: string;
  peer_name: string;
  peer_badge: string;
  peer_level?: number;
  last_message: ThreadMessage | null;
  updated_at: string;
  unread_count: number;
  pinned: boolean;
  inbox: 'primary' | 'general';
  muted: boolean;
  deleted: boolean;
};
export type PostInboxThread = ThreadBase & { kind: 'group' | 'direct'; post: CorePost };
export type InboxThread =
  | PostInboxThread
  | (ThreadBase & {
      kind: 'stealth';
      post: null;
      title: string;
      preview: string;
    });
export type InboxPage = { items: InboxThread[]; next_cursor: string | null; total_unread: number };
export type OrderSummary = {
  post: CorePost;
  members: { id: string; name: string; badge: string; level?: number; host: boolean }[];
  formed: boolean;
  completed: boolean;
  confirmed_count: number;
  my_confirmed: boolean;
  can_confirm: boolean;
};
export type Experience = {
  score: number;
  level: 1 | 2 | 3 | 4 | 5;
  completed_orders: number;
  completed_post_ids: string[];
  history_count: number;
};
export type OrderWorkflow = {
  stage: 'waiting' | 'formed' | 'en_route' | 'delivering' | 'completed';
  member_count: number;
  formation_votes: number;
  my_vote: boolean;
  host_vote: boolean;
  is_host: boolean;
  completed_count: number;
  my_completed: boolean;
};
export const socialApi = {
  inbox: async (kind: InboxFilter = 'all', cursor?: string, deleted = false, limit = 30) =>
    (await api.get<InboxPage>('/inbox', { params: { kind, cursor, deleted, limit } })).data,
  preference: async (
    thread: Pick<InboxThread, 'kind' | 'id'>,
    value: Partial<Pick<InboxThread, 'pinned' | 'inbox' | 'muted' | 'deleted'>>,
  ) =>
    (await api.patch<InboxThread>(`/inbox/${thread.kind}/${encodeURIComponent(thread.id)}`, value))
      .data,
  start: async (postId: string) =>
    (await api.post<PostInboxThread>('/direct-messages', { post_id: postId })).data,
  messages: async (id: string, cursor?: string) =>
    (
      await api.get<{
        thread: PostInboxThread;
        messages: ThreadMessage[];
        can_send: boolean;
        next_cursor: string | null;
      }>(`/direct-messages/${encodeURIComponent(id)}`, { params: { cursor, limit: 30 } })
    ).data,
  send: async (id: string, content: string, key: string) =>
    (
      await api.post<ThreadMessage>(
        `/direct-messages/${encodeURIComponent(id)}/messages`,
        { content },
        { headers: { 'Idempotency-Key': key } },
      )
    ).data,
  read: async (id: string, message_id: string) =>
    (await api.post(`/direct-messages/${encodeURIComponent(id)}/read`, { message_id })).data,
  order: async (postId: string) =>
    (await api.get<OrderSummary>(`/orders/${encodeURIComponent(postId)}/summary`)).data,
  workflow: async (postId: string) =>
    (await api.get<OrderWorkflow>(`/orders/${encodeURIComponent(postId)}/workflow`)).data,
  workflowAction: async (
    postId: string,
    action: 'vote' | 'depart' | 'purchase' | 'complete',
    image_id?: string,
  ) =>
    (
      await api.post<OrderWorkflow>(`/orders/${encodeURIComponent(postId)}/workflow`, {
        action,
        ...(image_id ? { image_id } : {}),
      })
    ).data,
  handoff: async (postId: string) =>
    (await api.post<OrderSummary>(`/orders/${encodeURIComponent(postId)}/handoff`)).data,
  experience: async () => (await api.get<Experience>('/account/experience')).data,
  writePost: async (
    mode: 'image' | 'voice',
    content: string,
    context: string,
    image_base64?: string | string[],
    options?: WritingOptions,
  ) =>
    runPostWritingJob(
      {
        mode,
        content,
        context,
        ...(Array.isArray(image_base64)
          ? { images_base64: image_base64 }
          : image_base64
            ? { image_base64 }
            : {}),
      },
      options,
    ),
};
export function useInboxThreads(kind: InboxFilter = 'all', deleted = false) {
  const actor = useAuthStore((s) => s.user?.id);
  const focused = useCoreScreenFocused();
  const query = useInfiniteQuery({
    queryKey: ['core', actor, 'social-inbox', kind, deleted],
    queryFn: ({ pageParam }) => socialApi.inbox(kind, pageParam, deleted),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.next_cursor ?? undefined,
    enabled: !!actor && focused && CORE_API_ENABLED && CORE_SUPABASE_MODE,
    retry: false,
    refetchInterval: focused ? 10_000 : false,
  });
  const unique = new Map<string, InboxThread>();
  for (const item of query.data?.pages.flatMap((p) => p.items) ?? [])
    if (!unique.has(item.kind + item.id)) unique.set(item.kind + item.id, item);
  return { ...query, items: [...unique.values()] };
}
export function useSocialUnread() {
  const actor = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['core', actor, 'social-unread'],
    queryFn: () => socialApi.inbox('all', undefined, false, 1),
    enabled: !!actor && CORE_API_ENABLED && CORE_SUPABASE_MODE,
    retry: false,
    refetchInterval: 15_000,
  });
}
export function useExperience() {
  const actor = useAuthStore((s) => s.user?.id);
  const focused = useCoreScreenFocused();
  return useQuery({
    queryKey: ['core', actor, 'experience'],
    queryFn: socialApi.experience,
    enabled: !!actor && focused && CORE_SUPABASE_MODE,
    retry: false,
  });
}
