import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { CORE_API_ENABLED, coreApi, toFeedPost } from '@/lib/core-api';
import { queryClient } from '@/lib/query-client';
import { useAuthStore } from '@/store/auth-store';
import { useAppStore } from '@/store/app-store';

export async function invalidateCore() {
  await queryClient.invalidateQueries({ queryKey: ['core'] });
}

export function useCoreScreenFocused() {
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));
  return focused;
}

export function useCorePosts(scope: 'feed' | 'hosted' | 'participating' | 'history' = 'feed', q = '', activeOnly = false) {
  const user = useAuthStore((state) => state.user);
  const focused = useCoreScreenFocused();
  const query = useInfiniteQuery({
    queryKey: ['core', user?.id, 'posts', scope, q, activeOnly],
    queryFn: ({ pageParam }) => coreApi.posts(scope, pageParam, q, activeOnly),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    enabled: CORE_API_ENABLED && !!user && focused,
    refetchInterval: 10_000,
  });
  useEffect(() => {
    if (CORE_API_ENABLED && scope === 'feed' && !q && !activeOnly && query.data) {
      const posts = query.data.pages.flatMap((page) => page.items);
      useAppStore.setState({
        posts: posts.map(toFeedPost),
        interestedPostIds: posts.filter((post) => ['pending', 'accepted'].includes(post.my_status)).map((post) => post.id),
      });
    }
  }, [scope, q, activeOnly, query.data]);
  return { ...query, posts: query.data?.pages.flatMap((page) => page.items) ?? [] };
}

export function useCorePost(id: string) {
  const user = useAuthStore((state) => state.user);
  const focused = useCoreScreenFocused();
  return useQuery({
    queryKey: ['core', user?.id, 'post', id],
    queryFn: () => coreApi.post(id),
    enabled: CORE_API_ENABLED && !!user && !!id && focused,
    refetchInterval: 10_000,
  });
}

export function useCoreRequests(postId: string, enabled = true) {
  const user = useAuthStore((state) => state.user);
  const focused = useCoreScreenFocused();
  return useQuery({
    queryKey: ['core', user?.id, 'requests', postId],
    queryFn: () => coreApi.requests(postId),
    enabled: CORE_API_ENABLED && !!user && !!postId && enabled && focused,
    refetchInterval: 10_000,
  });
}
