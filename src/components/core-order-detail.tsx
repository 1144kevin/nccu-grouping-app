import { ReputationBadge } from '@/components/reputation-badge';
import { PullRefreshControl } from '@/components/pull-refresh-control';
import { useMutation, useQuery } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
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
import { CorePostGallery } from '@/components/post-photo-carousel';
import { PostInfo } from '@/components/post-location';
import { RequestCard } from '@/components/core-order-screens';
import { postEmoji } from '@/components/core-profile';
import { MessageHostButton } from '@/components/message-host-button';
import {
  useCorePost,
  useCoreRequests,
  useCoreScreenFocused,
  invalidateCore,
} from '@/lib/core-hooks';
import { coreError, toFeedPost } from '@/lib/core-api';
import { socialApi } from '@/lib/social-api';
import { useAuthStore } from '@/store/auth-store';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export function CoreOrderDetail({ id }: { id: string }) {
  const actor = useAuthStore((s) => s.user?.id);
  const focused = useCoreScreenFocused();
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
    onSuccess: () => {
      void summary.refetch();
      void invalidateCore();
    },
  });
  if (!post)
    return (
      <Screen>
        <DetailHeader title="拼單詳情" />
        {postQuery.isPending ? (
          <ActivityIndicator />
        ) : (
          <EmptyState
            icon="clipboard-text-off-outline"
            title={postQuery.error ? coreError(postQuery.error) : '找不到這筆拼單'}
          />
        )}
      </Screen>
    );
  const completed = summary.data?.completed ?? false;
  const formed = summary.data?.formed ?? post.joined > 1;
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
  const status = completed
    ? '已完成'
    : post.status === 'cancelled'
      ? '已取消'
      : post.status === 'expired'
        ? '已截止'
        : formed
          ? '已成團'
          : '進行中';
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
            <Text style={styles.title}>{post.content.split('\n')[0]}</Text>
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
          <Step done={completed} label="完成面交" last />
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
              <Text style={styles.detail}>{member.host ? '主揪' : '團員'}</Text>
            </View>
            <Pill tone={member.host ? 'yellow' : 'success'}>{member.host ? '主揪' : '已加入'}</Pill>
          </Pressable>
        ))}
        {pending.map((request) => (
          <RequestCard key={request.id} request={request} closed={closed} />
        ))}
        {!pending.length ? <Text style={styles.empty}>這筆紀錄沒有待處理的申請</Text> : null}
        {summary.data?.can_confirm ? (
          <View style={{ gap: 8 }}>
            <Text style={styles.detail}>
              {summary.data.my_confirmed
                ? `你已確認面交 · ${summary.data.confirmed_count}/${post.joined} 人已確認`
                : '實際完成面交後，請確認紀錄。'}
            </Text>
            <PrimaryButton
              disabled={handoff.isPending || summary.data.my_confirmed}
              onPress={() => handoff.mutate()}
            >
              {summary.data.my_confirmed ? '已確認完成面交' : '確認完成面交'}
            </PrimaryButton>
          </View>
        ) : null}
        {handoff.error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {coreError(handoff.error)}
          </Text>
        ) : null}
        <SectionTitle>完整貼文</SectionTitle>
        <Text style={styles.body}>{post.content}</Text>
        <CorePostGallery post={post} />
        <View style={styles.tags}>
          {post.tags.map((tag) => (
            <Text key={tag} style={styles.tag}>
              #{tag}
            </Text>
          ))}
        </View>
        <PostInfo post={toFeedPost(post)} />
        {['host', 'accepted'].includes(post.my_status) ? (
          <PrimaryButton secondary onPress={() => router.push(`/chat/${post.id}`)}>
            進入群組聊天室
          </PrimaryButton>
        ) : null}
        {post.my_status === 'host' ? (
          <PrimaryButton secondary onPress={() => router.push(`/post/${post.id}`)}>
            管理貼文
          </PrimaryButton>
        ) : null}
        <MessageHostButton post={post} />
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
  body: { color: colors.ink, fontSize: 15, lineHeight: 23 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tag: { color: colors.brown, fontSize: 14 },
  error: { color: colors.danger, fontSize: 13 },
});
