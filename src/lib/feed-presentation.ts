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

function isFeedVisible(post: CorePost) {
  return (
    !post.completed &&
    post.status !== 'cancelled' &&
    (!post.workflow_stage || post.workflow_stage === 'waiting') &&
    !post.workflow_host_voted
  );
}

export function useFeedPresentation(rankedPosts: CorePost[]) {
  const [refresh, setRefresh] = useState(0);
  const ordered = orderFeedPosts(rankedPosts, refresh).filter(isFeedVisible);
  const actor = useAuthStore((state) => state.user?.id);
  const { data: published } = useQuery<CorePost | null>({
    queryKey: publishedKey(actor),
    queryFn: skipToken,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  const recentCandidate =
    actor && published?.author_id === actor
      ? ordered.find((post) => post.id === published.id) ?? published
      : null;
  const recent = recentCandidate && isFeedVisible(recentCandidate) ? recentCandidate : null;
  return {
    publishedId: recent?.id,
    posts: recent
      ? [recent, ...ordered.filter((post) => post.id !== recent.id)]
      : ordered,
    restoreRanking: () => {
      queryClient.setQueryData(publishedKey(actor), null);
      setRefresh((value) => value + 1);
    },
  };
}
