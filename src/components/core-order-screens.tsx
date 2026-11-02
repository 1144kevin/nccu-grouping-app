import { PageLoading } from '@/components/page-loading';
import { useCoreClock } from '@/lib/core-clock';
import { ReputationBadge } from '@/components/reputation-badge';
import { PullRefreshControl } from '@/components/pull-refresh-control';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/app-text';
import {
  AppHeader,
  Avatar,
  EmptyState,
  Pill,
  PrimaryButton,
  Screen,
} from '@/components/primitives';
import { coreApi, coreError, type CoreJoin, type CorePost } from '@/lib/core-api';
import { invalidateCore, useCorePost, useCorePosts, useCoreRequests } from '@/lib/core-hooks';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { shortDate } from '@/components/list-ui';
import { useCoreOrderActivity } from '@/lib/core-chat-hooks';
import { usePostCacheSync } from '@/lib/core-post-cache';

const statusLabels = { open: '進行中', full: '已額滿', expired: '已截止', cancelled: '已取消' };
const decisionLabels = {
  pending: '待接受',
  accepted: '已加入',
  rejected: '已拒絕',
  cancelled: '已退出／取消申請',
};

export function CoreOrdersScreen() {
  const clock = useCoreClock();
  const params = useLocalSearchParams<{ scope?: string }>();
  const scope =
    params.scope === 'history'
      ? 'history'
      : params.scope === 'participating'
        ? 'participating'
        : 'hosted';
  const query = useCorePosts(scope, '', true);
  const activity = useCoreOrderActivity(true);
  const posts = query.posts
    .filter(
      (p) =>
        !['expired', 'cancelled'].includes(p.status) && Date.parse(p.deadline_at) > clock.now(),
    )
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const missing =
    scope === 'hosted'
      ? activity.groups.filter((group) => !posts.some((p) => p.id === group.postId))
      : [];
  return (
    <Screen>
      <AppHeader searchScope="orders" />
      <View style={styles.orderTabs}>
        {(
          [
            { value: 'hosted', label: '我主揪的' },
            { value: 'participating', label: '想被揪的' },
          ] as const
        ).map((item) => (
          <Pressable
            key={item.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: scope === item.value }}
            onPress={() => router.setParams({ scope: item.value })}
            style={[styles.orderTab, scope === item.value && styles.orderTabActive]}
          >
            <Text style={[styles.tabLabel, scope === item.value && styles.tabLabelActive]}>
              {item.label}
              {item.value === 'hosted' && activity.pendingCount
                ? ` (${activity.pendingCount})`
                : ''}
            </Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        data={posts}
        keyExtractor={(post) => post.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
        refreshControl={
          <PullRefreshControl
            onRefresh={() => {
              return Promise.all([query.refetch(), activity.refetch()]);
            }}
          />
        }
        ListHeaderComponent={
          <>
            {query.error || activity.error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {coreError(query.error || activity.error)}
              </Text>
            ) : null}
          </>
        }
        ListEmptyComponent={
          !missing.length ? (
            <LoadState
              pending={query.isPending}
              error={query.error}
              retry={() => {
                return query.refetch();
              }}
            />
          ) : null
        }
        ListFooterComponent={
          <>
            {missing.map((group) => (
              <MissingHostedGroup key={group.postId} id={group.postId} />
            ))}
            {activity.hasNextPage && scope === 'hosted' ? (
              <PrimaryButton
                secondary
                disabled={activity.isFetchingNextPage}
                onPress={() => {
                  void activity.fetchNextPage();
                }}
              >
                更多申請
              </PrimaryButton>
            ) : null}
            {query.hasNextPage ? (
              <PrimaryButton
                secondary
                disabled={query.isFetchingNextPage}
                onPress={() => {
                  void query.fetchNextPage();
                }}
              >
                更多拼單
              </PrimaryButton>
            ) : null}
          </>
        }
        renderItem={({ item }) =>
          scope === 'hosted' ? (
            <HostedApplicants post={item} />
          ) : (
            <ParticipatingOrderRow post={item} />
          )
        }
      />
    </Screen>
  );
}
export function ParticipatingOrderRow({ post }: { post: CorePost }) {
  const label =
    post.status === 'expired' || post.status === 'cancelled'
      ? statusLabels[post.status]
      : post.my_status in decisionLabels
        ? decisionLabels[post.my_status as keyof typeof decisionLabels]
        : statusLabels[post.status];
  return (
    <View style={styles.participatingRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`查看 ${post.author_name} 的公開資料`}
        onPress={() => router.push(`/user/${post.author_id}`)}
      >
        <Avatar name={post.author_name} badge={post.author_badge ?? '🍱'} size={46} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`查看拼單 ${post.content}`}
        onPress={() => router.push(`/order/${post.id}`)}
        style={{ flex: 1 }}
      >
        <View style={[styles.row, { alignItems: 'flex-start' }]}>
          <View style={{ flex: 1, gap: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text numberOfLines={1} style={styles.participatingName}>
                {post.author_name}
              </Text>
              <ReputationBadge level={post.author_level} />
            </View>
            <Text style={styles.hint}>{shortDate(post.created_at)}</Text>
          </View>
          <Pill tone={post.my_status === 'accepted' ? 'success' : 'plain'}>{label}</Pill>
        </View>
        <Text numberOfLines={2} style={[styles.body, { marginTop: 6 }]}>
          {post.content}
        </Text>
      </Pressable>
    </View>
  );
}
function MissingHostedGroup({ id }: { id: string }) {
  const clock = useCoreClock();
  const query = useCorePost(id);
  return query.data?.my_status === 'host' &&
    !['expired', 'cancelled'].includes(query.data.status) &&
    Date.parse(query.data.deadline_at) > clock.now() ? (
    <HostedApplicants post={query.data} />
  ) : null;
}
function HostedApplicants({ post }: { post: CorePost }) {
  const sync = usePostCacheSync();
  const query = useCoreRequests(post.id);
  const [hidden, setHidden] = useState<string[]>([]);
  const decision = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'accepted' | 'rejected' }) =>
      coreApi.decide(id, status),
    onMutate: ({ id }) => {
      setHidden((old) => [...old, id]);
    },
    onError: (_error, { id }) => {
      setHidden((old) => old.filter((value) => value !== id));
    },
    onSettled: () => {
      void sync.refresh(post.id);
      void invalidateCore();
    },
  });
  const pending = query.data?.filter((r) => r.status === 'pending' && !hidden.includes(r.id)) ?? [];
  const closed = post.status === 'expired' || post.status === 'cancelled';
  return (
    <View style={styles.applicationGroup}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`查看完整拼單 ${post.content}`}
          style={{ flex: 1 }}
          onPress={() => router.push(`/order/${post.id}`)}
        >
          <Text numberOfLines={2} style={styles.groupTitle}>
            {post.content.split('\n')[0]}
          </Text>
          <Text style={styles.hint}>{shortDate(post.created_at)}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`查看 ${post.content} 的團員與貼文`}
          onPress={() => router.push(`/order/${post.id}`)}
        >
          <Text style={styles.link}>查看全部</Text>
        </Pressable>
      </View>
      <View style={styles.applicants}>
        {query.isPending ? <PageLoading /> : null}
        {pending.map((request) => (
          <RequestCard
            key={request.id}
            request={request}
            closed={closed}
            onDecision={(status) => decision.mutate({ id: request.id, status })}
          />
        ))}
        {!query.isPending && !query.error && !pending.length ? (
          <Text style={styles.emptyApplicants}>沒有待處理的申請</Text>
        ) : null}
        {query.error ? (
          <PrimaryButton
            secondary
            onPress={() => {
              return query.refetch();
            }}
          >
            重新載入申請
          </PrimaryButton>
        ) : null}
        {decision.error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {coreError(decision.error)} 申請已恢復，可重試。
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function LoadState({
  pending,
  error,
  retry,
}: {
  pending: boolean;
  error: unknown;
  retry: () => void;
}) {
  if (pending) return <PageLoading accessibilityLabel="載入拼單中" />;
  return (
    <EmptyState
      icon="clipboard-text-outline"
      title={error ? coreError(error) : '目前沒有拼單'}
      action={
        error ? (
          <PrimaryButton secondary onPress={retry}>
            重試
          </PrimaryButton>
        ) : undefined
      }
    />
  );
}

export function RequestCard({
  request,
  closed,
  onDecision,
}: {
  request: CoreJoin;
  closed: boolean;
  onDecision?: (status: 'accepted' | 'rejected') => void;
}) {
  const sync = usePostCacheSync();
  const mutation = useMutation({
    mutationFn: (status: 'accepted' | 'rejected') => coreApi.decide(request.id, status),
    onSettled: () => {
      void sync.refresh(request.post_id);
      void invalidateCore();
    },
  });
  return (
    <View style={[styles.member, request.status === 'pending' && !closed && styles.pendingMember]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`查看 ${request.requester_name} 的公開資料`}
        onPress={() => router.push(`/user/${request.requester_id}`)}
      >
        <Avatar name={request.requester_name} badge={request.requester_badge ?? '🍱'} size={42} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(`/user/${request.requester_id}`)}
        >
          <View style={styles.row}>
            <Text style={styles.requestName}>{request.requester_name}</Text>
            <ReputationBadge level={request.requester_level} />
          </View>
        </Pressable>
        <Text style={styles.hint}>{shortDate(request.created_at)}</Text>
      </View>
      {request.status === 'pending' && !closed ? (
        <View style={styles.row}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`拒絕 ${request.requester_name} 的申請`}
            disabled={mutation.isPending}
            onPress={() => (onDecision ? onDecision('rejected') : mutation.mutate('rejected'))}
          >
            <Text style={styles.hint}>刪除</Text>
          </Pressable>
          <PrimaryButton
            style={{ minHeight: 36, paddingHorizontal: 14 }}
            disabled={mutation.isPending}
            onPress={() => (onDecision ? onDecision('accepted') : mutation.mutate('accepted'))}
          >
            接受
          </PrimaryButton>
        </View>
      ) : (
        <Pill tone={request.status === 'accepted' ? 'success' : 'plain'}>
          {decisionLabels[request.status]}
        </Pill>
      )}
      {mutation.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {coreError(mutation.error)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  participatingName: {
    flexShrink: 1,
    color: colors.ink,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  participatingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  orderTabs: { flexDirection: 'row', paddingHorizontal: 18, gap: 12, paddingVertical: 10 },
  orderTab: {
    flex: 1,
    alignItems: 'center',
    height: 40,
    borderRadius: radius.pill,
    justifyContent: 'center',
  },
  orderTabActive: { backgroundColor: colors.yellow },
  tabLabel: { color: colors.muted, fontSize: 16 },
  tabLabelActive: { color: colors.ink, fontWeight: '700' },
  applicationGroup: { marginBottom: 28, gap: 8 },
  groupTitle: {
    color: colors.ink,
    fontFamily: typography.rounded,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 26,
  },
  applicants: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
    paddingHorizontal: 12,
  },
  emptyApplicants: { paddingVertical: 20, color: colors.muted, textAlign: 'center' },
  author: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  bottom: {
    minHeight: 70,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 120 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.ink, lineHeight: 24 },
  body: { fontSize: 17, lineHeight: 26, color: colors.ink },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  note: { paddingVertical: spacing.md, color: colors.muted, fontSize: 14, lineHeight: 22 },
  error: { color: colors.danger, padding: spacing.sm, fontSize: 13 },
  tabs: { padding: spacing.sm, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  attention: {
    padding: spacing.lg,
    backgroundColor: '#FFF9DF',
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  attentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EADCA8',
  },
  link: { color: colors.brown, fontSize: 13, fontWeight: '700', paddingVertical: 8 },
  requestName: {
    color: colors.ink,
    fontFamily: typography.rounded,
    fontSize: 15,
    fontWeight: '700',
  },
  member: {
    minHeight: 72,
    paddingVertical: 10,
    gap: 10,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pendingMember: { paddingVertical: 16 },
  card: {
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
});
