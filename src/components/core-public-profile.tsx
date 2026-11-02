import { PageLoading } from '@/components/page-loading';
import { ReputationBadge } from '@/components/reputation-badge';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useState } from 'react';
import { AppText as Text } from '@/components/app-text';
import {
  Avatar,
  DetailHeader,
  EmptyState,
  PrimaryButton,
  Screen,
  SectionTitle,
  IconButton,
} from '@/components/primitives';
import { coreApi, coreError, toFeedPost } from '@/lib/core-api';
import { useCoreScreenFocused } from '@/lib/core-hooks';
import { useAuthStore } from '@/store/auth-store';
import { colors, radius, spacing } from '@/theme/tokens';
import { FeedPostCard } from '@/components/feed-post-card';
import { ProfileLikes } from './profile-likes';
import { ReportButton } from '@/components/core-reports';
import { CloudBlockButton } from '@/components/core-user-blocks';

export function CorePublicProfile({ id }: { id: string }) {
  const [options, setOptions] = useState(false);
  const viewer = useAuthStore((state) => state.user);
  const focused = useCoreScreenFocused();
  const valid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id);
  const profile = useQuery({
    queryKey: ['core', viewer?.id, 'public-user', id],
    queryFn: () => coreApi.publicUser(id),
    enabled: !!viewer && focused && valid,
    retry: false,
  });
  const posts = useInfiniteQuery({
    queryKey: ['core', viewer?.id, 'user-posts', id],
    queryFn: ({ pageParam }) => coreApi.userPosts(id, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    enabled: !!viewer && focused && valid && !!profile.data,
  });
  const user = profile.error ? undefined : profile.data;
  return (
    <Screen>
      <DetailHeader
        title="個人資料"
        right={
          valid && viewer?.id !== id ? (
            <IconButton
              icon="dots-horizontal"
              label="使用者選項"
              onPress={() => setOptions(true)}
            />
          ) : undefined
        }
      />
      <Modal
        transparent
        visible={options}
        animationType="fade"
        onRequestClose={() => setOptions(false)}
      >
        <View style={styles.overlay}>
          <Pressable
            accessibilityLabel="關閉使用者選項"
            style={StyleSheet.absoluteFill}
            onPress={() => setOptions(false)}
          />
          <View style={styles.menu}>
            <View style={{ alignItems: 'flex-end' }}>
              <IconButton icon="close" label="關閉選項" onPress={() => setOptions(false)} />
            </View>
            <ScrollView>
              <CloudBlockButton id={id} name={profile.data?.display_name} />
              <ReportButton kind="user" targetId={id} />
            </ScrollView>
          </View>
        </View>
      </Modal>
      {!valid ? (
        <EmptyState icon="account-question-outline" title="找不到這位使用者" />
      ) : !user ? (
        profile.isPending ? (
          <PageLoading />
        ) : (
          <View style={styles.content}>
            <Text accessibilityRole="alert" style={styles.error}>
              {coreError(profile.error)}
            </Text>
            <PrimaryButton
              secondary
              onPress={() => {
                void profile.refetch();
              }}
            >
              重新載入
            </PrimaryButton>
          </View>
        )
      ) : (
        <FlatList
          data={posts.data?.pages.flatMap((page) => page.items) ?? []}
          keyExtractor={(post) => post.id}
          contentContainerStyle={styles.content}
          ListHeaderComponent={
            <View style={styles.header}>
              <Avatar name={user.display_name} badge={user.badge} userId={id} size={72} />
              <Text style={styles.name}>{user.display_name}</Text>
              <ReputationBadge level={user.level} />
              <Text style={styles.body}>{user.bio || '尚未填寫個人介紹'}</Text>
              <Text style={styles.hint}>
                加入日期：{new Date(user.created_at).toLocaleDateString('zh-TW')} · 目前有{' '}
                {user.active_posts} 筆未截止且未取消的拼單
              </Text>
              {viewer?.id === id ? (
                <PrimaryButton secondary onPress={() => router.push('/edit-profile')}>
                  編輯我的個人資料
                </PrimaryButton>
              ) : (
                <Text style={styles.hint}></Text>
              )}
              <ProfileLikes id={id} />
              <SectionTitle>公開拼單</SectionTitle>
              {posts.error ? (
                <Text accessibilityRole="alert" style={styles.error}>
                  {coreError(posts.error)}
                </Text>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            posts.isPending ? (
              <PageLoading />
            ) : (
              <Text style={styles.hint}>
                {posts.error ? '拼單暫時無法載入，請重試。' : '目前沒有公開拼單。'}
              </Text>
            )
          }
          ListFooterComponent={
            posts.hasNextPage ? (
              <PrimaryButton
                secondary
                disabled={posts.isFetchingNextPage}
                onPress={() => {
                  void posts.fetchNextPage();
                }}
              >
                載入更多
              </PrimaryButton>
            ) : posts.error ? (
              <PrimaryButton
                secondary
                onPress={() => {
                  void posts.refetch();
                }}
              >
                重試拼單
              </PrimaryButton>
            ) : null
          }
          renderItem={({ item }) => (
            <FeedPostCard post={toFeedPost(item)} corePost={item} respectHidden={false} />
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 100 },
  header: { padding: spacing.lg, gap: spacing.md, marginBottom: spacing.md },
  overlay: {
    flex: 1,
    backgroundColor: '#00000055',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  menu: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '85%',
    backgroundColor: colors.background,
    padding: 16,
    borderRadius: 22,
    gap: 12,
  },
  name: { color: colors.ink, fontSize: 22, fontWeight: '700' },
  body: { color: colors.ink, fontSize: 16, lineHeight: 24 },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 21 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 21 },
  card: {
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
});
