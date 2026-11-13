import { PageLoading } from '@/components/page-loading';
import { ReputationBadge } from '@/components/reputation-badge';
import { PullRefreshControl } from '@/components/pull-refresh-control';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { router } from 'expo-router';
import { FlatList, Platform, Pressable, StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/app-text';
import { Avatar, DetailHeader, EmptyState, PrimaryButton, Screen } from '@/components/primitives';
import { coreError, type CoreOrderActivity } from '@/lib/core-api';
import { useCoreOrderActivity } from '@/lib/core-chat-hooks';
import { shortDate } from '@/components/list-ui';
import { colors, radius, spacing } from '@/theme/tokens';
import { usePenaltyNotices } from '@/lib/penalty-notices';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth-store';
import { NotificationReadBadge } from '@/components/notification-read-badge';
import type { NotificationBadge } from '@/lib/notification-badge';

const watermarkMemory = new Map<string, string>();

function readWatermark(actor?: string): string | null {
  if (!actor) return null;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      return window.localStorage.getItem(`notifications_read_at:${actor}`);
    } catch {
      /* ignore storage errors */
    }
  }
  return watermarkMemory.get(actor) ?? null;
}

function writeWatermark(actor: string | undefined, iso: string) {
  if (!actor) return;
  watermarkMemory.set(actor, iso);
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(`notifications_read_at:${actor}`, iso);
    } catch {
      /* ignore storage errors */
    }
  }
}

type OrderEventItem = {
  id: string;
  kind: string;
  post_id: string;
  post_content: string;
  points: number | null;
  created_at: string;
  read_at?: string | null;
};

type PenaltyNoticeItem = {
  id: string;
  points: number;
  response?: string | null;
  created_at: string;
  read_at?: string | null;
};

type UnifiedNotification =
  | { kind: 'event'; key: string; timestamp: string; event: OrderEventItem }
  | { kind: 'penalty'; key: string; timestamp: string; notice: PenaltyNoticeItem }
  | { kind: 'activity'; key: string; timestamp: string; item: CoreOrderActivity };

export function CoreOrderActivityScreen() {
  const actor = useAuthStore((state) => state.user?.id);
  const [visitCutoff] = useState<string | null>(() => readWatermark(actor));
  const cachedBadge = queryClient.getQueryData<NotificationBadge>([
    'core',
    actor,
    'notification-badge',
  ]);
  const initialOrdersUnreadRef = useRef<number | null>(cachedBadge?.orders ?? null);

  useEffect(() => {
    void api
      .post('/notifications/read', {})
      .then(() => {
        writeWatermark(actor, new Date().toISOString());
        return queryClient.invalidateQueries({
          queryKey: ['core'],
          predicate: (q) =>
            q.queryKey[2] === 'chat-activity' || q.queryKey[2] === 'notification-badge',
        });
      })
      .catch(() => undefined);
  }, [actor]);
  return (
    <Screen>
      <DetailHeader title="通知中心" />
      <CoreRequestActivity
        visitCutoff={visitCutoff}
        initialOrdersUnread={initialOrdersUnreadRef.current}
      />
    </Screen>
  );
}

function CoreRequestActivity({
  visitCutoff,
  initialOrdersUnread,
}: {
  visitCutoff: string | null;
  initialOrdersUnread: number | null;
}) {
  const query = useCoreOrderActivity(true);
  const notices = usePenaltyNotices();
  const actor = useAuthStore((state) => state.user?.id);
  const [locallyReadKeys, setLocallyReadKeys] = useState<Set<string>>(() => new Set());
  const markLocalRead = (key: string) => {
    setLocallyReadKeys((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  };
  const events = useQuery({
    queryKey: ['core', actor, 'order-events'],
    queryFn: async () =>
      (
        await api.get<{
          items: OrderEventItem[];
        }>('/notifications/order-events')
      ).data,
    enabled: !!actor,
  });
  useEffect(() => {
    if (!events.data?.items.length) return;
    void api
      .post('/notifications/order-events/read')
      .then(() => {
        writeWatermark(actor, new Date().toISOString());
        return queryClient.invalidateQueries({ queryKey: ['core', actor, 'notification-badge'] });
      })
      .catch(() => undefined);
  }, [actor, events.dataUpdatedAt, events.data?.items.length]);
  const markRead = useMutation({
    mutationFn: (id: string) => api.post('/notifications/penalties/read', { id }),
    onSuccess: (_data, id) => {
      markLocalRead(`penalty:${id}`);
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: ['core', actor, 'penalty-notices'] }),
        queryClient.invalidateQueries({ queryKey: ['core', actor, 'notification-badge'] }),
      ]);
    },
  });

  const unifiedItems = useMemo<UnifiedNotification[]>(() => {
    const merged: UnifiedNotification[] = [];
    for (const event of events.data?.items ?? []) {
      merged.push({
        kind: 'event',
        key: `event:${event.id}`,
        timestamp: event.created_at,
        event,
      });
    }
    for (const notice of notices.data?.items ?? []) {
      merged.push({
        kind: 'penalty',
        key: `penalty:${notice.id}`,
        timestamp: notice.created_at,
        notice,
      });
    }
    for (const item of query.items) {
      merged.push({
        kind: 'activity',
        key: `activity:${item.id}`,
        timestamp: item.occurred_at,
        item,
      });
    }
    merged.sort((a, b) => (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0));
    return merged;
  }, [events.data?.items, notices.data?.items, query.items]);

  const isItemUnread = (entry: UnifiedNotification): boolean => {
    if (locallyReadKeys.has(entry.key)) return false;
    if (entry.kind === 'penalty') return !entry.notice.read_at;
    if (entry.kind === 'event' && entry.event.read_at) return false;
    if (initialOrdersUnread === 0) return false;
    if (visitCutoff) {
      return (Date.parse(entry.timestamp) || 0) > (Date.parse(visitCutoff) || 0);
    }
    return (initialOrdersUnread ?? 0) > 0;
  };
  return (
    <View style={{ flex: 1 }}>
      {query.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {coreError(query.error)}
        </Text>
      ) : null}
      <FlatList
        data={unifiedItems}
        keyExtractor={(entry) => entry.key}
        contentContainerStyle={styles.list}
        refreshControl={
          <PullRefreshControl
            onRefresh={() => {
              return Promise.all([query.refetch(), notices.refetch(), events.refetch()]);
            }}
          />
        }
        ListHeaderComponent={
          <View>
            {notices.error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                通知載入失敗，請下拉重試。
              </Text>
            ) : null}
            {markRead.error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                無法標記已讀，請再試一次。
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          query.isPending ? (
            <PageLoading />
          ) : (
            <EmptyState
              icon="bell-outline"
              title={query.error ? '動態載入失敗' : '目前沒有拼單動態'}
              action={
                query.error ? (
                  <PrimaryButton
                    secondary
                    onPress={() => {
                      return query.refetch();
                    }}
                  >
                    重試
                  </PrimaryButton>
                ) : undefined
              }
            />
          )
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
        renderItem={({ item: entry }) => {
          const unread = isItemUnread(entry);
          if (entry.kind === 'event') {
            const { event } = entry;
            return (
              <Pressable
                accessibilityRole="button"
                style={[styles.card, unread && styles.unreadCard]}
                onPress={() => {
                  markLocalRead(entry.key);
                  router.push(`/order/${event.post_id}`);
                }}
              >
                <View style={styles.cardHeader}>
                  <Text style={[styles.title, styles.flexTitle]}>
                    {(
                      {
                        order_waiting: '團員退出，拼單重新等待成團',
                        order_formation_pending: '主揪提出成團',
                        order_formed: '拼單已成團',
                        order_en_route: '主揪已出發',
                        order_delivering: '主揪已完成購買',
                        order_cancelled: '拼單已取消',
                        completed: '拼單已完成',
                        order_penalty: `信譽積分扣除 ${event.points ?? 0} 分`,
                      } as Record<string, string>
                    )[event.kind] ?? '拼單狀態已更新'}
                  </Text>
                  <NotificationReadBadge unread={unread} />
                </View>
                <Text style={styles.hint}>{shortDate(event.created_at)}</Text>
                <Text numberOfLines={2} style={styles.body}>
                  {event.post_content}
                </Text>
              </Pressable>
            );
          }
          if (entry.kind === 'penalty') {
            const { notice } = entry;
            return (
              <View style={[styles.card, unread && styles.unreadCard]}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.title, styles.flexTitle]}>
                    信譽積分扣除 {notice.points} 分
                  </Text>
                  <NotificationReadBadge unread={unread} />
                </View>
                <Text style={styles.hint}>{shortDate(notice.created_at)}</Text>
                <Text style={styles.body}>
                  {notice.response || '經管理員審核後，已調整你的信譽積分。'}
                </Text>
                {unread ? (
                  <PrimaryButton
                    secondary
                    disabled={markRead.isPending}
                    onPress={() => markRead.mutate(notice.id)}
                  >
                    標為已讀
                  </PrimaryButton>
                ) : null}
              </View>
            );
          }
          const { item } = entry;
          const pendingHosted =
            item.kind === 'hosted_request' &&
            item.status === 'pending' &&
            !item.post_cancelled &&
            !item.post_expired;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`查看動態 ${activityTitle(item)}`}
              style={[styles.card, unread && styles.unreadCard]}
              onPress={() => {
                markLocalRead(entry.key);
                router.push({
                  pathname: '/order/[id]',
                  params: {
                    id: item.post_id,
                    ...(pendingHosted ? { focus: 'requests' } : {}),
                  },
                });
              }}
            >
              <View style={styles.row}>
                <Avatar
                  name={item.requester_name}
                  badge={item.requester_badge ?? '🍱'}
                  userId={item.requester_id}
                  size={42}
                />
                <View style={{ flex: 1 }}>
                  <View style={styles.cardHeader}>
                    <Text style={[styles.title, styles.flexTitle]}>{activityTitle(item)}</Text>
                    <NotificationReadBadge unread={unread} />
                  </View>
                  <ReputationBadge level={item.requester_level} />
                  <Text style={styles.hint}>{shortDate(item.occurred_at)}</Text>
                </View>
              </View>
              <Text numberOfLines={2} style={styles.body}>
                {item.post_content}
              </Text>
              {pendingHosted ? <Text style={styles.action}>審核申請 →</Text> : null}
              {item.post_cancelled || item.post_expired ? (
                <Text style={styles.hint}>
                  {item.post_cancelled ? '這筆拼單目前已取消。' : '這筆拼單目前已截止。'}
                </Text>
              ) : null}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

function activityTitle(item: CoreOrderActivity): string {
  if (item.kind === 'my_request')
    return {
      pending: '你的申請等待主揪接受',
      accepted: '你的申請已獲接受',
      rejected: '主揪未接受你的申請',
      cancelled: '你已退出或取消申請',
    }[item.status];
  return {
    pending: `${item.requester_name} 等待你審核`,
    accepted: `已接受 ${item.requester_name} 的申請`,
    rejected: `已拒絕 ${item.requester_name} 的申請`,
    cancelled: `${item.requester_name} 已退出或取消申請`,
  }[item.status];
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  action: { color: colors.brown, fontWeight: '700', fontSize: 13 },
  note: { padding: spacing.md, color: colors.muted, fontSize: 13, lineHeight: 21 },
  list: { padding: spacing.md, paddingBottom: 100 },
  card: {
    marginBottom: spacing.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  unreadCard: {
    borderColor: '#E8CA54',
    backgroundColor: '#FFFDF3',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  flexTitle: { flex: 1 },
  title: { color: colors.ink, fontSize: 16, fontWeight: '700', lineHeight: 24 },
  body: { color: colors.ink, fontSize: 14, lineHeight: 22 },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 20 },
  error: { padding: spacing.md, color: colors.danger, fontSize: 13 },
});
