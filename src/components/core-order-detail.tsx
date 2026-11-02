import { PageLoading } from '@/components/page-loading';
import { ReputationBadge } from '@/components/reputation-badge';
import { PullRefreshControl } from '@/components/pull-refresh-control';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/app-text';
import {
  Avatar,
  DetailHeader,
  EmptyState,
  Pill,
  PrimaryButton,
  Screen,
  SectionTitle,
} from '@/components/primitives';
import { FeedPostCard } from '@/components/feed-post-card';
import { HostPostControls } from '@/components/host-post-controls';
import { RequestCard } from '@/components/core-order-screens';
import { postEmoji } from '@/components/core-profile';
import {
  useCorePost,
  useCoreRequests,
  useCoreScreenFocused,
  invalidateCore,
} from '@/lib/core-hooks';
import { coreError, toFeedPost } from '@/lib/core-api';
import { socialApi } from '@/lib/social-api';
import { usePostCacheSync } from '@/lib/core-post-cache';
import { orderStateLabel } from '@/lib/order-state';
import { useAuthStore } from '@/store/auth-store';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export function CoreOrderDetail({ id }: { id: string }) {
  const sync = usePostCacheSync();
  const actor = useAuthStore((s) => s.user?.id);
  const focused = useCoreScreenFocused();
  useEffect(() => {
    if (actor && focused)
      void api
        .post('/notifications/read', { post_id: id })
        .then(() => queryClient.invalidateQueries({ queryKey: ['core', actor, 'chat-activity'] }))
        .catch(() => undefined);
  }, [actor, focused, id]);
  const postQuery = useCorePost(id);
  const post = postQuery.data;
  const summary = useQuery({
    queryKey: ['core', actor, 'order-summary', id],
    queryFn: () => socialApi.order(id),
    enabled: !!actor && focused && !!post,
    retry: false,
    refetchInterval: focused ? 10000 : false,
  });
  const requests = useCoreRequests(id, post?.my_status === 'host');
  const handoff = useMutation({
    mutationFn: () => socialApi.handoff(id),
    onSuccess: (updated) => {
      if (!actor || useAuthStore.getState().user?.id !== actor) return;
      sync.update(updated.post);
      queryClient.setQueryData(['core', actor, 'order-summary', id], updated);
      void summary.refetch();
      void invalidateCore();
    },
  });
  if (!post)
    return (
      <Screen>
        <DetailHeader title="拼單詳情" />
        {postQuery.isPending ? (
          <PageLoading />
        ) : (
          <EmptyState
            icon="clipboard-text-off-outline"
            title={postQuery.error ? coreError(postQuery.error) : '找不到這筆拼單'}
          />
        )}
      </Screen>
    );
  const completed = summary.data?.completed ?? post.completed ?? false;
  const formed = completed || post.joined >= post.capacity;
  const members = summary.data?.members ?? [
    {
      id: post.author_id,
      name: post.author_name,
      badge: post.author_badge ?? '🍱',
      level: post.author_level,
      host: true,
    },
    ...(requests.data
      ?.filter((r) => r.status === 'accepted')
      .map((r) => ({
        id: r.requester_id,
        name: r.requester_name,
        badge: r.requester_badge ?? '🍱',
        level: r.requester_level,
        host: false,
      })) ?? []),
  ];
  const pending = requests.data?.filter((r) => r.status === 'pending') ?? [];
  const closed = post.status === 'expired' || post.status === 'cancelled';
  const status = orderStateLabel(post, completed);
  return (
    <Screen>
      <DetailHeader title="拼單詳情" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <PullRefreshControl
            onRefresh={() => {
              return Promise.all([
                postQuery.refetch(),
                summary.refetch(),
                ...(post?.my_status === 'host' ? [requests.refetch()] : []),
              ]);
            }}
          />
        }
      >
        <View style={styles.heading}>
          <View style={styles.emoji}>
            <Text fixedSize style={styles.emojiText}>
              {postEmoji(post)}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={2} ellipsizeMode="tail" style={styles.title}>
              {post.content}
            </Text>
            <Text style={styles.detail}>
              {new Date(post.created_at).toLocaleDateString('zh-TW', {
                month: 'long',
                day: 'numeric',
              })}{' '}
              · {post.joined}/{post.capacity} 人
            </Text>
          </View>
          <Pill tone={completed ? 'success' : post.status === 'open' ? 'yellow' : 'plain'}>
            {status}
          </Pill>
        </View>
        <View style={styles.timeline}>
          <Step done label="已建立拼單" />
          <Step done={formed} label={formed ? '已確認成團' : '等待成團'} />
          <Step done={completed} label="完成訂單" last />
        </View>
        <SectionTitle
          action={
            pending.length ? <Text style={styles.detail}>{pending.length} 位申請</Text> : undefined
          }
        >
          團員與申請
        </SectionTitle>
        {members.map((member) => (
          <Pressable
            key={member.id}
            accessibilityRole="button"
            accessibilityLabel={`查看 ${member.name} 的個人檔案`}
            onPress={() => router.push(`/user/${member.id}`)}
            style={styles.member}
          >
            <Avatar name={member.name} badge={member.badge} size={42} />
            <View style={{ flex: 1 }}>
              <Text style={styles.memberName}>{member.name}</Text>
              <ReputationBadge level={member.level} />
            </View>
            <Pill tone={member.host ? 'yellow' : 'success'}>{member.host ? '主揪' : '已加入'}</Pill>
          </Pressable>
        ))}
        {pending.map((request) => (
          <RequestCard key={request.id} request={request} closed={closed} />
        ))}
        {post.my_status === 'host' && requests.isPending ? <PageLoading /> : null}
        {post.my_status === 'host' && requests.error ? (
          <View style={{ gap: 8 }}>
            <Text accessibilityRole="alert" style={styles.error}>
              {coreError(requests.error)}
            </Text>
            <PrimaryButton secondary onPress={() => requests.refetch()}>
              重試申請清單
            </PrimaryButton>
          </View>
        ) : !pending.length && !requests.isPending ? (
          <Text style={styles.empty}>這筆紀錄沒有待處理的申請</Text>
        ) : null}
        {summary.data?.can_confirm ? (
          <View style={{ gap: 8 }}>
            <Text style={styles.detail}>
              {summary.data.my_confirmed
                ? `你已確認完成 · ${summary.data.confirmed_count}/${post.joined} 人已確認`
                : '餐點已交付、雙方完成約定後，請各自確認完成訂單。全員確認後計入信譽積分。'}
            </Text>
            <PrimaryButton
              disabled={handoff.isPending || summary.data.my_confirmed}
              onPress={() => handoff.mutate()}
              loading={handoff.isPending}
            >
              {summary.data.my_confirmed ? '已確認完成訂單' : '確認完成訂單'}
            </PrimaryButton>
          </View>
        ) : null}
        {handoff.error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {coreError(handoff.error)}
          </Text>
        ) : null}
        <SectionTitle>完整貼文</SectionTitle>
        <View style={{ marginHorizontal: -spacing.lg }}>
          <FeedPostCard
            post={toFeedPost(post)}
            corePost={post}
            respectHidden={false}
            showManagement={false}
          />
        </View>
        {['host', 'accepted'].includes(post.my_status) ? (
          <PrimaryButton secondary onPress={() => router.push(`/chat/${post.id}`)}>
            進入拼單聊天室
          </PrimaryButton>
        ) : null}
        {post.my_status === 'host' ? <HostPostControls key={post.id} post={post} /> : null}
      </ScrollView>
    </Screen>
  );
}
function Step({ done, label, last = false }: { done: boolean; label: string; last?: boolean }) {
  return (
    <View style={styles.step}>
      <View style={styles.marker}>
        <View style={[styles.dot, done && styles.dotDone]}>
          {done ? <MaterialCommunityIcons name="check" size={11} color={colors.ink} /> : null}
        </View>
        {!last ? <View style={[styles.line, done && { backgroundColor: colors.yellow }]} /> : null}
      </View>
      <Text style={[styles.stepText, done && { color: colors.ink, fontWeight: '600' }]}>
        {label}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 40, gap: 12 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emoji: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: '#F2E5CC',
  },
  emojiText: { fontSize: 30 },
  title: {
    color: colors.ink,
    fontFamily: typography.rounded,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 23,
  },
  detail: { marginTop: 4, color: colors.muted, fontSize: 13, lineHeight: 19 },
  timeline: {
    marginVertical: 18,
    padding: 16,
    flexDirection: 'row',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  step: { flex: 1, alignItems: 'center' },
  marker: { width: '100%', alignItems: 'center' },
  dot: {
    width: 22,
    height: 22,
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 11,
    backgroundColor: colors.background,
  },
  dotDone: { borderColor: colors.yellow, backgroundColor: colors.yellow },
  line: {
    position: 'absolute',
    top: 10,
    left: '50%',
    width: '100%',
    height: 2,
    backgroundColor: colors.border,
  },
  stepText: { marginTop: 8, color: colors.muted, fontSize: 12, textAlign: 'center' },
  member: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  memberName: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  empty: { paddingVertical: 24, color: colors.muted, textAlign: 'center', fontSize: 14 },
  error: { color: colors.danger, fontSize: 13 },
});
