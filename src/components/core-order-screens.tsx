import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Share,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { AppText as Text } from '@/components/app-text';
import {
  AppHeader,
  Avatar,
  DetailHeader,
  EmptyState,
  IconButton,
  Pill,
  PrimaryButton,
  Screen,
  SectionTitle,
} from '@/components/primitives';
import { PostInfo } from '@/components/post-location';
import { CorePostActions } from '@/components/core-post-actions';
import { CorePostImage } from '@/components/core-post-image';
import {
  CORE_SUPABASE_MODE,
  coreApi,
  coreError,
  toFeedPost,
  type CoreJoin,
  type CorePost,
} from '@/lib/core-api';
import { invalidateCore, useCorePost, useCorePosts, useCoreRequests } from '@/lib/core-hooks';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CorePostRow, SegmentedTabs, shortDate } from '@/components/list-ui';
import { useCoreOrderActivity } from '@/lib/core-chat-hooks';
import { ReportButton } from '@/components/core-reports';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const statusLabels = { open: '進行中', full: '已額滿', expired: '已截止', cancelled: '已取消' };
const decisionLabels = {
  pending: '待接受',
  accepted: '已加入',
  rejected: '已拒絕',
  cancelled: '已退出／取消申請',
};

export function CorePostDetail({ id }: { id: string }) {
  const insets = useSafeAreaInsets();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const query = useCorePost(id);
  if (!query.data)
    return (
      <Screen>
        <DetailHeader title="拼單詳情" />
        <LoadState
          pending={query.isPending}
          error={query.error}
          retry={() => {
            void query.refetch();
          }}
        />
      </Screen>
    );
  const post = query.data;
  return (
    <Screen>
      <DetailHeader title="拼單詳情" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={query.isFetching}
            onRefresh={() => {
              void query.refetch();
            }}
          />
        }
      >
        <View style={styles.row}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`查看 ${post.author_name} 的公開資料`}
            onPress={() => router.push(`/user/${post.author_id}`)}
            style={styles.author}
          >
            <Avatar name={post.author_name} badge={post.author_badge ?? '🍱'} size={46} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.title}>{post.author_name}</Text>
              <Text style={styles.hint}>{shortDate(post.created_at)}</Text>
            </View>
          </Pressable>
          <Pill>{statusLabels[post.status]}</Pill>
        </View>
        {post.is_demo ? <Pill>示範資料</Pill> : null}
        {post.my_status === 'host' && focus === 'requests' ? <HostManagement post={post} /> : null}
        <Text style={styles.body}>{post.content}</Text>
        {post.image_id ? <CorePostImage imageId={post.image_id} /> : null}
        <View style={styles.tags}>
          {post.tags.map((tag) => (
            <Pressable
              key={tag}
              accessibilityRole="button"
              onPress={() =>
                router.push({ pathname: '/search', params: { scope: 'posts', query: tag } })
              }
            >
              <Text style={styles.link}>#{tag}</Text>
            </Pressable>
          ))}
        </View>
        <PostInfo post={toFeedPost(post)} />
        {CORE_SUPABASE_MODE && ['host', 'accepted'].includes(post.my_status) ? (
          <PrimaryButton secondary onPress={() => router.push(`/chat/${post.id}`)}>
            進入拼單聊天室
          </PrimaryButton>
        ) : null}
        {query.error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {coreError(query.error)}
          </Text>
        ) : null}
        {post.my_status === 'host' ? (
          focus !== 'requests' ? (
            <HostManagement post={post} />
          ) : null
        ) : null}
        {CORE_SUPABASE_MODE ? <ReportButton kind="post" targetId={post.id} /> : null}
      </ScrollView>
      {post.my_status !== 'host' ? (
        <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
          <IconButton
            icon="share-variant-outline"
            label="分享拼單"
            onPress={() => {
              void Share.share({ message: `政缺一咖拼單：${post.content}` });
            }}
          />
          <CorePostActions post={post} />
        </View>
      ) : null}
    </Screen>
  );
}

export function CoreOrdersScreen() {
  const params = useLocalSearchParams<{ scope?: string }>();
  const scope =
    params.scope === 'history'
      ? 'history'
      : params.scope === 'participating'
        ? 'participating'
        : 'hosted';
  const query = useCorePosts(scope);
  const activity = useCoreOrderActivity(true);
  const [onlyPending, setOnlyPending] = useState(false);
  const pending = new Map(activity.groups.map((group) => [group.postId, group]));
  const posts = [...query.posts].sort(
    (a, b) => Number(pending.has(b.id)) - Number(pending.has(a.id)),
  );
  return (
    <Screen>
      <AppHeader searchScope="orders" />
      <SegmentedTabs
        value={scope}
        onChange={(value) => {
          setOnlyPending(false);
          router.setParams({ scope: value });
        }}
        options={[
          { value: 'hosted', label: '我主揪的', count: activity.pendingCount },
          { value: 'participating', label: '想被揪的' },
          { value: 'history', label: '過往紀錄' },
        ]}
      />
      <FlatList
        data={onlyPending ? [] : posts}
        keyExtractor={(post) => post.id}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={query.isFetching && !query.isFetchingNextPage}
            onRefresh={() => {
              void query.refetch();
              void activity.refetch();
            }}
          />
        }
        ListHeaderComponent={
          <>
            {activity.pendingCount > 0 ? (
              <View style={styles.attention}>
                <View style={styles.row}>
                  <MaterialCommunityIcons
                    name="bell-badge-outline"
                    size={20}
                    color={colors.danger}
                  />
                  <Text style={styles.title}>{activity.pendingCount} 位夥伴等你審核</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setOnlyPending(!onlyPending)}
                  >
                    <Text style={styles.link}>{onlyPending ? '顯示全部' : '只看待處理'}</Text>
                  </Pressable>
                </View>
                {activity.groups.map((group) => (
                  <Pressable
                    key={group.postId}
                    accessibilityRole="button"
                    accessibilityLabel={`審核 ${group.content} 的 ${group.count} 筆申請`}
                    onPress={() =>
                      router.push({
                        pathname: '/order/[id]',
                        params: { id: group.postId, focus: 'requests' },
                      })
                    }
                    style={styles.attentionRow}
                  >
                    <Avatar name={group.names[0]} badge="🍱" size={38} />
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text numberOfLines={1} style={styles.requestName}>
                        {group.names.slice(0, 2).join('、')}
                        {group.count > 2 ? ` 等 ${group.count} 人` : ''}
                      </Text>
                      <Text numberOfLines={1} style={styles.hint}>
                        {group.content}
                      </Text>
                    </View>
                    <Text style={styles.link}>審核申請</Text>
                    <MaterialCommunityIcons name="chevron-right" size={17} color={colors.brown} />
                  </Pressable>
                ))}
                {activity.isFetchingNextPage ? (
                  <ActivityIndicator accessibilityLabel="載入待審申請" />
                ) : null}
                {activity.error ? (
                  <Text accessibilityRole="alert" style={styles.error}>
                    {coreError(activity.error)}
                  </Text>
                ) : null}
                {activity.hasNextPage ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      void activity.fetchNextPage();
                    }}
                  >
                    <Text style={styles.link}>載入更多動態</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            {query.error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {coreError(query.error)}
              </Text>
            ) : null}
          </>
        }
        ListEmptyComponent={
          !onlyPending ? (
            <LoadState
              pending={query.isPending}
              error={query.error}
              retry={() => {
                void query.refetch();
              }}
            />
          ) : null
        }
        ListFooterComponent={
          !onlyPending && query.hasNextPage ? (
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
        renderItem={({ item }) => (
          <CorePostRow
            post={item}
            order
            notice={
              pending.has(item.id) ? `${pending.get(item.id)!.count} 筆申請待審核` : undefined
            }
          />
        )}
      />
    </Screen>
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
  if (pending) return <ActivityIndicator accessibilityLabel="載入拼單中" />;
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

function HostManagement({ post }: { post: CorePost }) {
  const query = useCoreRequests(post.id);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const mutation = useMutation({
    mutationFn: () => coreApi.cancel(post.id),
    onSettled: invalidateCore,
  });
  const closed = post.status === 'expired' || post.status === 'cancelled';
  return (
    <View style={{ gap: spacing.md }}>
      {post.can_edit ? (
        <PrimaryButton secondary onPress={() => router.push(`/edit-post/${post.id}`)}>
          編輯拼單
        </PrimaryButton>
      ) : null}
      <SectionTitle
        action={
          query.data?.some((r) => r.status === 'pending') ? (
            <Pill tone="yellow">
              {query.data.filter((r) => r.status === 'pending').length} 筆待審核
            </Pill>
          ) : undefined
        }
      >
        團員與申請
      </SectionTitle>
      <View style={styles.member}>
        <Avatar name={post.author_name} badge={post.author_badge ?? '🍱'} size={42} />
        <Text style={styles.title}>{post.author_name}</Text>
        <Pill tone="yellow">主揪</Pill>
      </View>
      {query.isPending ? <ActivityIndicator /> : null}
      {query.error ? (
        <View>
          <Text accessibilityRole="alert" style={styles.error}>
            {coreError(query.error)}
          </Text>
          <PrimaryButton
            secondary
            onPress={() => {
              void query.refetch();
            }}
          >
            重試申請清單
          </PrimaryButton>
        </View>
      ) : null}
      {query.data &&
        [...query.data]
          .sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending'))
          .map((request) => <RequestCard key={request.id} request={request} closed={closed} />)}
      {query.data?.length === 0 ? <Text style={styles.hint}>尚未有人申請。</Text> : null}
      {!closed && !confirmCancel ? (
        <PrimaryButton secondary onPress={() => setConfirmCancel(true)}>
          取消這筆拼單
        </PrimaryButton>
      ) : null}
      {confirmCancel && !closed ? (
        <View style={styles.card}>
          <Text style={styles.note}>確定取消整筆拼單？取消後不能再加入或接受申請。</Text>
          <PrimaryButton disabled={mutation.isPending} onPress={() => mutation.mutate()}>
            確認取消拼單
          </PrimaryButton>
          <PrimaryButton
            secondary
            disabled={mutation.isPending}
            onPress={() => setConfirmCancel(false)}
          >
            繼續保留
          </PrimaryButton>
        </View>
      ) : null}
      {mutation.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {coreError(mutation.error)}
        </Text>
      ) : null}
    </View>
  );
}

function RequestCard({ request, closed }: { request: CoreJoin; closed: boolean }) {
  const mutation = useMutation({
    mutationFn: (status: 'accepted' | 'rejected') => coreApi.decide(request.id, status),
    onSettled: invalidateCore,
  });
  return (
    <View style={[styles.member, request.status === 'pending' && !closed && styles.pendingMember]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`查看 ${request.requester_name} 的公開資料`}
        onPress={() => router.push(`/user/${request.requester_id}`)}
      >
        <Avatar name={request.requester_name} badge="🍱" size={42} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={styles.requestName}>{request.requester_name}</Text>
        <Text style={styles.hint}>{shortDate(request.created_at)}</Text>
      </View>
      {request.status === 'pending' && !closed ? (
        <View style={styles.row}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`拒絕 ${request.requester_name} 的申請`}
            disabled={mutation.isPending}
            onPress={() => mutation.mutate('rejected')}
          >
            <Text style={styles.hint}>拒絕</Text>
          </Pressable>
          <PrimaryButton
            style={{ minHeight: 36, paddingHorizontal: 14 }}
            disabled={mutation.isPending}
            onPress={() => mutation.mutate('accepted')}
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
  pendingMember: { backgroundColor: '#FFF9DF', borderRadius: radius.md, paddingHorizontal: 10 },
  card: {
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
});
