import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/app-text';
import { AppHeader, Avatar, DetailHeader, EmptyState, Pill, PrimaryButton, Screen, SectionTitle } from '@/components/primitives';
import { PostInfo } from '@/components/post-location';
import { CorePostActions } from '@/components/core-post-actions';
import { CORE_SUPABASE_MODE, coreApi, coreError, toFeedPost, type CoreJoin, type CorePost } from '@/lib/core-api';
import { invalidateCore, useCorePost, useCorePosts, useCoreRequests } from '@/lib/core-hooks';
import { colors, radius, spacing } from '@/theme/tokens';

const statusLabels = { open: '進行中', full: '已額滿', expired: '已截止', cancelled: '已取消' };
const decisionLabels = { pending: '待接受', accepted: '已加入', rejected: '已拒絕', cancelled: '已退出／取消申請' };

export function CorePostDetail({ id }: { id: string }) {
  const query = useCorePost(id);
  if (!query.data) return <Screen><DetailHeader title="拼單詳情" /><LoadState pending={query.isPending} error={query.error} retry={() => { void query.refetch(); }} /></Screen>;
  const post = query.data;
  return <Screen>
    <DetailHeader title="拼單詳情" />
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={query.isFetching} onRefresh={() => { void query.refetch(); }} />}>
      <View style={styles.row}><Avatar name={post.author_name} badge={post.author_badge ?? '🍱'} /><Text style={styles.title}>{post.author_name}</Text><Pill>{statusLabels[post.status]}</Pill></View>
      {post.is_demo ? <Text style={styles.note}>示範拼單：僅供操作測試，不會真的訂購或付款。示範人物無法登入；他們當主揪的拼單可測試申請與退出，不會自動接受申請。</Text> : null}
      <Text style={styles.body}>{post.content}</Text>
      <Text style={styles.hint}>{post.tags.map((tag) => `#${tag}`).join('　')}</Text>
      <PostInfo post={toFeedPost(post)} />
      {CORE_SUPABASE_MODE && ['host','accepted'].includes(post.my_status) ? <PrimaryButton secondary onPress={() => router.push(`/chat/${post.id}`)}>進入拼單聊天室</PrimaryButton> : null}
      <Text style={styles.note}>送出申請後，由主揪接受才會占用名額。截止前可取消申請，已加入者退出會釋出名額。費用與取餐請自行協調。</Text>
      {query.error ? <Text accessibilityRole="alert" style={styles.error}>{coreError(query.error)}</Text> : null}
      {post.my_status === 'host' ? <HostManagement post={post} /> : <CorePostActions post={post} />}
    </ScrollView>
  </Screen>;
}

export function CoreOrdersScreen() {
  const params = useLocalSearchParams<{ scope?: string }>();
  const scope = params.scope === 'history' ? 'history' : params.scope === 'participating' ? 'participating' : 'hosted';
  const setScope = (value: 'hosted' | 'participating' | 'history') => router.setParams({ scope: value });
  const query = useCorePosts(scope);
  return <Screen>
    <AppHeader title="我的拼單" searchScope="orders" />
    <View style={styles.tabs}>
      <PrimaryButton secondary={scope !== 'hosted'} onPress={() => setScope('hosted')}>我主揪的</PrimaryButton>
      <PrimaryButton secondary={scope !== 'participating'} onPress={() => setScope('participating')}>申請／已加入</PrimaryButton>
      <PrimaryButton secondary={scope !== 'history'} onPress={() => setScope('history')}>過往紀錄</PrimaryButton>
    </View>
    {scope === 'history' ? <Text style={styles.hint}>已截止、已取消，以及你退出或被拒絕的拼單。再次申請後會回到「申請／已加入」。</Text> : null}
    {query.error ? <Text accessibilityRole="alert" style={styles.error}>{coreError(query.error)}</Text> : null}
    <FlatList data={query.posts} keyExtractor={(post) => post.id}
      ListHeaderComponent={CORE_SUPABASE_MODE ? <DemoControls /> : null}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={query.isFetching && !query.isFetchingNextPage} onRefresh={() => { void query.refetch(); }} />}
      ListEmptyComponent={<LoadState pending={query.isPending} error={query.error} retry={() => { void query.refetch(); }} />}
      ListFooterComponent={query.hasNextPage ? <PrimaryButton secondary disabled={query.isFetchingNextPage} onPress={() => { void query.fetchNextPage(); }}>載入更多</PrimaryButton> : null}
      renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`查看拼單 ${item.content}`} style={styles.card} onPress={() => router.push(`/order/${item.id}`)}>
        <Text style={styles.title}>{item.content}</Text>
        {item.is_demo ? <Pill>示範資料</Pill> : null}
        <Text style={styles.hint}>{item.author_name} · {item.joined}/{item.capacity} 人 · {statusLabels[item.status]}</Text>
        <Text style={styles.hint}>截止：{new Date(item.deadline_at).toLocaleString('zh-TW')}</Text>
        <Text style={styles.hint}>{item.my_status === 'host' ? '主揪：查看團員與申請' : item.my_status === 'pending' ? '等待主揪接受，尚未占名額' : item.my_status === 'accepted' ? '你已加入' : item.my_status === 'rejected' ? '主揪未接受這次申請' : item.my_status === 'cancelled' ? '你已退出／取消申請' : '尚未加入'}</Text>
      </Pressable>}
    />
  </Screen>;
}

function DemoControls() {
  const [confirm, setConfirm] = useState(false);
  const mutation = useMutation({ mutationFn: coreApi.clearDemo, onSuccess: () => { setConfirm(false); void invalidateCore(); } });
  return <View style={styles.card}>
    <Text style={styles.title}>開發示範拼單</Text>
    <Text style={styles.hint}>搜尋「開發示範」可查看各種狀態。我主揪的便當可練習接受申請，可頌可練習編輯。清理只移除分配給你的示範拼單，已有其他真實使用者參與的會保留。</Text>
    {!confirm ? <PrimaryButton secondary onPress={() => setConfirm(true)}>清理我的示範拼單</PrimaryButton> : <>
      <Text style={styles.note}>確認移除示範拼單、示範申請與相關聊天訊息？清理後不會自動重新建立。</Text>
      <PrimaryButton disabled={mutation.isPending} onPress={() => mutation.mutate()}>確認清理示範資料</PrimaryButton>
      <PrimaryButton secondary disabled={mutation.isPending} onPress={() => setConfirm(false)}>繼續保留</PrimaryButton>
    </>}
    {mutation.data ? <Text accessibilityRole="alert" style={styles.hint}>已移除 {mutation.data.deleted_posts} 筆；保留 {mutation.data.kept_posts} 筆有真實使用者參與的示範拼單。</Text> : null}
    {mutation.error ? <Text accessibilityRole="alert" style={styles.error}>{coreError(mutation.error)}</Text> : null}
  </View>;
}

function LoadState({ pending, error, retry }: { pending: boolean; error: unknown; retry: () => void }) {
  if (pending) return <ActivityIndicator accessibilityLabel="載入拼單中" />;
  return <EmptyState icon="clipboard-text-outline" title={error ? coreError(error) : '目前沒有拼單'} action={error ? <PrimaryButton secondary onPress={retry}>重試</PrimaryButton> : undefined} />;
}

function HostManagement({ post }: { post: CorePost }) {
  const query = useCoreRequests(post.id);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const mutation = useMutation({ mutationFn: () => coreApi.cancel(post.id), onSettled: invalidateCore });
  const closed = post.status === 'expired' || post.status === 'cancelled';
  return <View style={{ gap: spacing.md }}>
    {post.can_edit ? <PrimaryButton secondary onPress={() => router.push(`/edit-post/${post.id}`)}>編輯拼單</PrimaryButton> : !closed ? <Text style={styles.hint}>已有申請或團員時，不能修改拼單條件。</Text> : null}
    <SectionTitle>團員與申請</SectionTitle>
    <Text style={styles.hint}>主揪：{post.author_name}（已計入名額）</Text>
    {query.isPending ? <ActivityIndicator /> : null}
    {query.error ? <View><Text accessibilityRole="alert" style={styles.error}>{coreError(query.error)}</Text><PrimaryButton secondary onPress={() => { void query.refetch(); }}>重試申請清單</PrimaryButton></View> : null}
    {query.data?.map((request) => <RequestCard key={request.id} request={request} closed={closed} />)}
    {query.data?.length === 0 ? <Text style={styles.hint}>尚未有人申請。</Text> : null}
    {!closed && !confirmCancel ? <PrimaryButton secondary onPress={() => setConfirmCancel(true)}>取消這筆拼單</PrimaryButton> : null}
    {confirmCancel && !closed ? <View style={styles.card}>
      <Text style={styles.note}>確定取消整筆拼單？取消後不能再加入或接受申請。</Text>
      <PrimaryButton disabled={mutation.isPending} onPress={() => mutation.mutate()}>確認取消拼單</PrimaryButton>
      <PrimaryButton secondary disabled={mutation.isPending} onPress={() => setConfirmCancel(false)}>繼續保留</PrimaryButton>
    </View> : null}
    {mutation.error ? <Text accessibilityRole="alert" style={styles.error}>{coreError(mutation.error)}</Text> : null}
  </View>;
}

function RequestCard({ request, closed }: { request: CoreJoin; closed: boolean }) {
  const mutation = useMutation({
    mutationFn: (status: 'accepted' | 'rejected') => coreApi.decide(request.id, status),
    onSettled: invalidateCore,
  });
  return <View style={styles.card}>
    <View style={styles.row}><Text style={styles.title}>{request.requester_name}</Text><Pill>{decisionLabels[request.status]}</Pill></View>
    <Text style={styles.hint}>{new Date(request.created_at).toLocaleString('zh-TW')}</Text>
    {request.status === 'pending' && !closed ? <View style={styles.tabs}>
      <PrimaryButton disabled={mutation.isPending} onPress={() => mutation.mutate('accepted')}>接受</PrimaryButton>
      <PrimaryButton secondary disabled={mutation.isPending} onPress={() => mutation.mutate('rejected')}>拒絕</PrimaryButton>
    </View> : null}
    {mutation.error ? <Text accessibilityRole="alert" style={styles.error}>{coreError(mutation.error)}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 120 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.ink, lineHeight: 24 },
  body: { fontSize: 17, lineHeight: 26, color: colors.ink },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  note: { paddingVertical: spacing.md, color: colors.muted, fontSize: 14, lineHeight: 22 },
  error: { color: colors.danger, padding: spacing.sm, fontSize: 13 },
  tabs: { padding: spacing.sm, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card: { padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, marginBottom: spacing.md },
});
