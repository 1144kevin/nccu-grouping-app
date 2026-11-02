import { skipToken, useQuery } from '@tanstack/react-query';
import type { CorePost } from '@/lib/core-api';
import { queryClient } from '@/lib/query-client';
import { useAuthStore } from '@/store/auth-store';
import { useState } from 'react';
import { orderFeedPosts } from './feed-ordering';

const publishedKey = (actor: string | undefined) => ['core', actor, 'newly-published-post'];

export function showPublishedPost(actor: string, post: CorePost) {
  // In-memory presentation state shares the existing account/session cache reset.
  queryClient.setQueryData(publishedKey(actor), post);
  queryClient.setQueryData(['core', actor, 'post', post.id], post);
}

export function useFeedPresentation(rankedPosts: CorePost[]) {
  const [refresh, setRefresh] = useState(0);
  const ordered = orderFeedPosts(rankedPosts, refresh);
  const actor = useAuthStore((state) => state.user?.id);
  const { data: published } = useQuery<CorePost | null>({
    queryKey: publishedKey(actor),
    queryFn: skipToken,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  const recent = actor && published?.author_id === actor ? published : null;
  return {
    publishedId: recent?.id,
    posts: recent
      ? [
          ordered.find((post) => post.id === recent.id) ?? recent,
          ...ordered.filter((post) => post.id !== recent.id),
        ]
      : ordered,
    restoreRanking: () => {
      queryClient.setQueryData(publishedKey(actor), null);
      setRefresh((value) => value + 1);
    },
  };
}
