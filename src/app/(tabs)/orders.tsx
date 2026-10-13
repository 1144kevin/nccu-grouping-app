import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader, Avatar, EmptyState, IconButton, Pill, PrimaryButton, Screen } from '@/components/primitives';
import { useAppStore } from '@/store/app-store';
import type { JoinRequest } from '@/types/domain';
import { colors, radius, spacing, typography } from '@/theme/tokens';

type OrderTab = 'hosted' | 'interested';

export default function OrdersScreen() {
  const [tab, setTab] = useState<OrderTab>('hosted');
  return (
    <Screen>
      <AppHeader searchScope="orders" />
      <View style={styles.tabs}><TabButton active={tab === 'hosted'} label="我主揪的" onPress={() => setTab('hosted')} /><TabButton active={tab === 'interested'} label="想被揪的" onPress={() => setTab('interested')} /></View>
      {tab === 'hosted' ? <HostedOrders /> : <InterestedOrders />}
    </Screen>
  );
}

function TabButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.tab, active && styles.activeTab]}><Text style={[styles.tabText, active && styles.activeTabText]}>{label}</Text></Pressable>;
}

function HostedOrders() {
  const requests = useAppStore((state) => state.requests);
  const groups = useMemo(() => Object.entries(requests.reduce<Record<string, JoinRequest[]>>((result, item) => ({ ...result, [item.postTitle]: [...(result[item.postTitle] ?? []), item] }), {})), [requests]);
  return <ScrollView contentContainerStyle={styles.list}>{groups.map(([title, items]) => <View key={title} style={styles.group}><View style={styles.groupHeader}><View style={{ flex: 1 }}><Text style={styles.groupTitle}>{title}</Text><Text style={styles.date}>今天</Text></View><Pressable onPress={() => router.push(`/order/${items[0].postId}`)}><Text style={styles.viewAll}>查看全部</Text></Pressable></View><View style={styles.requestBox}>{items.map((request, index) => <RequestRow key={request.id} request={request} first={index === 0} />)}</View></View>)}</ScrollView>;
}

function RequestRow({ request, first }: { request: JoinRequest; first: boolean }) {
  const updateRequest = useAppStore((state) => state.updateRequest);
  return <View style={[styles.requestRow, !first && styles.requestDivider]}><Pressable onPress={() => router.push(`/user/${encodeURIComponent(request.name)}`)}><Avatar name={request.name} badge={request.badge} size={42} /></Pressable><Pressable onPress={() => router.push(`/user/${encodeURIComponent(request.name)}`)} style={styles.requestText}><Text numberOfLines={1} style={styles.requestName}>{request.name}</Text><Text style={styles.requestMeta}>{request.badge} Lv.{request.level} · {request.requestedAt}</Text></Pressable>{request.status === 'pending' ? <><Pressable onPress={() => Alert.alert('拒絕申請？', `將拒絕 ${request.name} 的加入申請。`, [{ text: '取消', style: 'cancel' }, { text: '拒絕', style: 'destructive', onPress: () => updateRequest(request.id, 'rejected') }])}><Text style={styles.delete}>刪除</Text></Pressable><PrimaryButton style={styles.accept} onPress={() => { updateRequest(request.id, 'accepted'); Alert.alert('已接受', '現在可前往訊息頁聯絡對方。'); }}>接受</PrimaryButton></> : <Pill tone={request.status === 'accepted' ? 'success' : 'danger'}>{request.status === 'accepted' ? '已接受' : '已拒絕'}</Pill>}</View>;
}

function InterestedOrders() {
  const posts = useAppStore((state) => state.posts);
  const ids = useAppStore((state) => state.interestedPostIds);
  const startConversation = useAppStore((state) => state.startConversation);
  const items = posts.filter((post) => ids.includes(post.id));
  if (!items.length) return <EmptyState icon="account-search-outline" title="尚未對任何拼單表示興趣" />;
  return <FlatList data={items} keyExtractor={(item) => item.id} contentContainerStyle={styles.interestedList} ListHeaderComponent={<Text style={styles.dateHeading}>今天</Text>} renderItem={({ item, index }) => <View style={[styles.interestedRow, index > 0 && styles.requestDivider]}><Pressable onPress={() => router.push(`/post/${item.id}`)}><Avatar name={item.name} badge={item.badge} size={46} /></Pressable><Pressable onPress={() => router.push(`/post/${item.id}`)} style={styles.requestText}><Text style={styles.requestName}>{item.name}　<Text style={styles.requestMeta}>{item.badge} Lv.{item.level}</Text></Text><Text numberOfLines={1} style={styles.preview}>{item.content}</Text></Pressable><IconButton icon="message-outline" label={`傳訊息給 ${item.name}`} onPress={() => router.push(`/chat/${startConversation(item.name, item.badge, item.level)}`)} /></View>} />;
}

const styles = StyleSheet.create({
  tabs: { height: 48, flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: colors.yellow },
  tabText: { color: colors.muted, fontFamily: typography.regular, fontSize: 14 },
  activeTabText: { color: colors.ink, fontWeight: '700' },
  list: { padding: spacing.lg, paddingBottom: 120 },
  group: { marginBottom: spacing.xl },
  groupHeader: { minHeight: 54, flexDirection: 'row', alignItems: 'center' },
  groupTitle: { color: colors.ink, fontFamily: typography.rounded, fontSize: 16, fontWeight: '700' },
  date: { marginTop: 4, color: colors.muted, fontSize: 12 },
  viewAll: { color: colors.yellow, fontFamily: typography.rounded, fontSize: 13, fontWeight: '700' },
  requestBox: { overflow: 'hidden', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  requestRow: { minHeight: 65, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 9 },
  requestDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  requestText: { flex: 1 },
  requestName: { color: colors.ink, fontFamily: typography.rounded, fontSize: 14, fontWeight: '700' },
  requestMeta: { marginTop: 3, color: colors.muted, fontFamily: typography.regular, fontSize: 10 },
  delete: { padding: spacing.sm, color: colors.muted, fontFamily: typography.regular, fontSize: 13 },
  accept: { minHeight: 36, paddingHorizontal: 13 },
  interestedList: { paddingBottom: 120, margin: spacing.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  dateHeading: { padding: 12, color: colors.ink, fontFamily: typography.rounded, fontWeight: '700' },
  interestedRow: { minHeight: 72, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  preview: { marginTop: 4, color: colors.muted, fontFamily: typography.regular, fontSize: 12 },
});
