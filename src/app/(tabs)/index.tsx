import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/app-text';
import { AppHeader, EmptyState, PrimaryButton, Screen } from '@/components/primitives';
import { PullRefreshControl } from '@/components/pull-refresh-control';
import { PullToRefresh } from '@/components/pull-to-refresh';
import { FeedPostCard } from '@/components/feed-post-card';
import { useAppStore } from '@/store/app-store';
import {
  CORE_API_ENABLED,
  CORE_SUPABASE_MODE,
  coreError,
  toFeedPost,
  type CorePost,
} from '@/lib/core-api';
import { useFeedPresentation } from '@/lib/feed-presentation';
import { useCoreRecommendations } from '@/lib/engagement-api';
import { useCorePosts } from '@/lib/core-hooks';
import { useAuthStore } from '@/store/auth-store';
import { colors } from '@/theme/tokens';

export default function HomeScreen() {
  const actor = useAuthStore((state) => state.user?.id);
  return CORE_API_ENABLED ? <CoreHomeScreen key={actor} /> : <DemoHomeScreen />;
}

function CoreHomeScreen() {
  const latest = useCorePosts('feed', '', false, 30, !CORE_SUPABASE_MODE);
  const recommendations = useCoreRecommendations(CORE_SUPABASE_MODE);
  const query = CORE_SUPABASE_MODE ? recommendations : latest;
  const feed = useFeedPresentation(query.posts);
  const list = useRef<FlatList<CorePost>>(null);
  const refresh = () => {
    feed.restoreRanking();
    return query.refetch();
  };
  useFocusEffect(
    useCallback(() => {
      if (feed.publishedId) list.current?.scrollToOffset({ offset: 0, animated: false });
    }, [feed.publishedId]),
  );
  return (
    <Screen>
      <AppHeader searchScope="posts" />
      <PullToRefresh onRefresh={refresh}>
        <FlatList
          testID="home-feed"
          ref={list}
          data={feed.posts}
          keyExtractor={(post) => post.id}
          renderItem={({ item }) => <FeedPostCard post={toFeedPost(item)} corePost={item} />}
          ItemSeparatorComponent={() => <View style={styles.divider} />}
          refreshControl={
            <PullRefreshControl
              testID="home-feed-refresh"
              onRefresh={refresh}
              tintColor={colors.yellow}
            />
          }
          ListHeaderComponent={
            query.error ? (
              <View>
                <Text accessibilityRole="alert">{coreError(query.error)}</Text>
                <PrimaryButton
                  secondary
                  disabled={query.isFetching}
                  onPress={() => {
                    return query.refetch();
                  }}
                >
                  重試
                </PrimaryButton>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              loading={query.isPending}
              icon="text-box-search-outline"
              title={
                query.isPending
                  ? '載入拼單中'
                  : query.error
                    ? '無法取得拼單，請下拉重試'
                    : '目前沒有拼單，建立第一筆吧'
              }
              action={
                <PrimaryButton
                  secondary
                  onPress={() => (query.error ? void query.refetch() : router.push('/create'))}
                >
                  {query.error ? '重試' : '建立拼單'}
                </PrimaryButton>
              }
            />
          }
          ListFooterComponent={
            query.hasNextPage ? (
              <PrimaryButton
                secondary
                disabled={query.isFetchingNextPage}
                onPress={() => {
                  void query.fetchNextPage();
                }}
              >
                載入更多
              </PrimaryButton>
            ) : null
          }
          contentContainerStyle={feed.posts.length ? styles.feed : styles.emptyFeed}
        />
      </PullToRefresh>
    </Screen>
  );
}

function DemoHomeScreen() {
  const posts = useAppStore((state) => state.posts);
  const blocked = useAppStore((state) => state.blockedUserNames);
  const visiblePosts = posts.filter((post) => !blocked.includes(post.name));

  async function refresh() {
    await new Promise((resolve) => setTimeout(resolve, 550));
  }

  return (
    <Screen>
      <AppHeader searchScope="posts" />
      <PullToRefresh onRefresh={refresh}>
        <FlatList
          data={visiblePosts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <FeedPostCard post={item} />}
          ItemSeparatorComponent={() => <View style={styles.divider} />}
          refreshControl={<PullRefreshControl onRefresh={refresh} tintColor={colors.yellow} />}
          ListEmptyComponent={
            <EmptyState
              icon="text-box-search-outline"
              title="目前沒有可顯示的拼單"
              action={
                <PrimaryButton secondary onPress={() => router.push('/search')}>
                  前往搜尋
                </PrimaryButton>
              }
            />
          }
          contentContainerStyle={visiblePosts.length ? styles.feed : styles.emptyFeed}
        />
      </PullToRefresh>
    </Screen>
  );
}

const styles = StyleSheet.create({
  feed: { paddingBottom: 120 },
  emptyFeed: { flexGrow: 1, paddingBottom: 120 },
  divider: { height: 1, backgroundColor: colors.border },
});
