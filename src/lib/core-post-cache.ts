import { useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query';
import { coreApi, type CorePost, type CorePostPage } from './core-api';
import { useAuthStore } from '@/store/auth-store';

type PostUpdate = Pick<CorePost, 'id'> & Partial<CorePost>;
const revisions = new WeakMap<QueryClient, Map<string, number>>();

function revisionMap(client: QueryClient) {
  if (!revisions.has(client)) revisions.set(client, new Map());
  return revisions.get(client)!;
}

// Update existing cards in place: preserve page order, pagination and image queries.
export function updateCachedPost(client: QueryClient, actor: string, update: PostUpdate) {
  const merge = (old: CorePost) => {
    if (old.id !== update.id || (old.version ?? 0) > (update.version ?? Infinity)) return old;
    return { ...old, ...update };
  };
  const page = (old: CorePostPage) => {
    const items = old.items.map(merge);
    return items.every((post, index) => post === old.items[index]) ? old : { ...old, items };
  };
  client.setQueriesData<InfiniteData<CorePostPage>>(
    {
      queryKey: ['core', actor],
      predicate: (q) => ['posts', 'recommendations'].includes(String(q.queryKey[2])),
    },
    (old) => {
      if (!old) return old;
      const pages = old.pages.map(page);
      return pages.every((p, index) => p === old.pages[index]) ? old : { ...old, pages };
    },
  );
  client.setQueriesData<CorePost>(
    {
      queryKey: ['core', actor],
      predicate: (q) => ['post', 'newly-published-post'].includes(String(q.queryKey[2])),
    },
    (old) => (old ? merge(old) : old),
  );
  client.setQueriesData<CorePostPage>(
    { queryKey: ['core', actor, 'semantic-feed-validation'] },
    (old) => (old ? page(old) : old),
  );
}

export function usePostCacheSync() {
  const actor = useAuthStore((s) => s.user?.id);
  const client = useQueryClient();
  const versions = revisionMap(client);
  const key = (id: string) => `${actor}:${id}`;
  const update = (post: PostUpdate) => {
    if (actor && useAuthStore.getState().user?.id === actor) {
      versions.set(key(post.id), (versions.get(key(post.id)) ?? 0) + 1);
      updateCachedPost(client, actor, post);
    }
  };
  return {
    update,
    refresh: async (id: string) => {
      if (!actor) return;
      const revision = versions.get(key(id));
      try {
        const post = await coreApi.post(id);
        if (useAuthStore.getState().user?.id === actor && versions.get(key(id)) === revision)
          updateCachedPost(client, actor, post);
      } catch {
        // Keep the confirmed mutation result if the follow-up read is unavailable.
      }
    },
  };
}
