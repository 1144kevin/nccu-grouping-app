import { useInfiniteQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { AppText as Text } from '@/components/app-text';
import { DetailHeader, EmptyState, PrimaryButton, Screen } from '@/components/primitives';
import { coreApi, coreError, type CoreOrderActivity } from '@/lib/core-api';
import { useCoreScreenFocused } from '@/lib/core-hooks';
import { useAuthStore } from '@/store/auth-store';
import { colors, radius, spacing } from '@/theme/tokens';

export function CoreOrderActivityScreen() {
  const user = useAuthStore((state) => state.user);
  const focused = useCoreScreenFocused();
  const query = useInfiniteQuery({
    queryKey: ['core', user?.id, 'order-activity'], queryFn: ({ pageParam }) => coreApi.orderActivity(pageParam),
    initialPageParam: undefined as string | undefined, getNextPageParam: (last) => last.next_cursor ?? undefined,
    enabled: !!user && focused, refetchInterval: 15_000,
  });
  const items = [...(query.data?.pages.flatMap((page) => page.items) ?? []).reduce((map, item) => {
    if (!map.has(item.id)) map.set(item.id, item);
    return map;
  }, new Map<string, CoreOrderActivity>()).values()];
  return <Screen>
    <DetailHeader title="拼單動態" />
    <Text style={styles.note}>查看申請、審核與退出的最新狀態。這裡顯示每筆申請目前的結果；手機推播尚未啟用。</Text>
    {query.error ? <Text accessibilityRole="alert" style={styles.error}>{coreError(query.error)}</Text> : null}
    <FlatList data={items} keyExtractor={(item) => item.id} contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={query.isFetching && !query.isFetchingNextPage} onRefresh={() => { void query.refetch(); }} />}
      ListEmptyComponent={query.isPending ? <ActivityIndicator /> : <EmptyState icon="bell-outline" title={query.error ? '動態載入失敗' : '目前沒有拼單動態'} action={query.error ? <PrimaryButton secondary onPress={() => { void query.refetch(); }}>重試</PrimaryButton> : undefined} />}
      ListFooterComponent={query.hasNextPage ? <PrimaryButton secondary disabled={query.isFetchingNextPage} onPress={() => { void query.fetchNextPage(); }}>載入更多</PrimaryButton> : null}
      renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`查看動態 ${activityTitle(item)}`} style={styles.card} onPress={() => router.push(`/order/${item.post_id}`)}>
        <Text style={styles.title}>{activityTitle(item)}</Text>
        <Text numberOfLines={2} style={styles.body}>{item.post_content}</Text>
        <Text style={styles.hint}>{new Date(item.occurred_at).toLocaleString('zh-TW')}</Text>
        {item.post_cancelled || item.post_expired ? <Text style={styles.hint}>{item.post_cancelled ? '這筆拼單目前已取消。' : '這筆拼單目前已截止。'}</Text> : null}
      </Pressable>}
    />
  </Screen>;
}

function activityTitle(item: CoreOrderActivity): string {
  if (item.kind === 'my_request') return { pending: '你的申請等待主揪接受', accepted: '你的申請已獲接受', rejected: '主揪未接受你的申請', cancelled: '你已退出或取消申請' }[item.status];
  return { pending: `${item.requester_name} 等待你審核`, accepted: `已接受 ${item.requester_name} 的申請`, rejected: `已拒絕 ${item.requester_name} 的申請`, cancelled: `${item.requester_name} 已退出或取消申請` }[item.status];
}

const styles = StyleSheet.create({
  note: { padding: spacing.md, color: colors.muted, fontSize: 13, lineHeight: 21 },
  list: { padding: spacing.md, paddingBottom: 100 },
  card: { marginBottom: spacing.md, padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  title: { color: colors.ink, fontSize: 16, fontWeight: '700', lineHeight: 24 },
  body: { color: colors.ink, fontSize: 14, lineHeight: 22 },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 20 },
  error: { padding: spacing.md, color: colors.danger, fontSize: 13 },
});
