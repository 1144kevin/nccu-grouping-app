import { AppText as Text } from '@/components/app-text';
import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppHeader, Avatar, EmptyState, IconButton, Screen } from '@/components/primitives';
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
  const pending = request.status === 'pending';
  const accepted = request.status === 'accepted';
  return (
    <View style={[styles.requestRow, !first && styles.requestDivider]}>
      <Pressable onPress={() => router.push(`/user/${encodeURIComponent(request.name)}`)}><Avatar name={request.name} badge={request.badge} size={42} /></Pressable>
      <Pressable onPress={() => router.push(`/user/${encodeURIComponent(request.name)}`)} style={styles.requestText}>
        <Text numberOfLines={1} style={styles.requestName}>{request.name}</Text>
        <Text style={styles.requestMeta}>{request.badge} Lv.{request.level} · {request.requestedAt}</Text>
      </Pressable>
      <View style={styles.requestActions}>
        {pending ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`刪除 ${request.name} 的申請`}
            onPress={() => updateRequest(request.id, 'rejected')}
            style={({ pressed }) => [styles.decisionButton, pressed && styles.decisionPressed]}
          >
            <Text style={styles.decisionText}>刪除</Text>
          </Pressable>
        ) : <View style={styles.decisionPlaceholder} />}
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={pending ? `接受 ${request.name} 的申請` : `${accepted ? '已接受' : '已刪除'}，重新選擇 ${request.name} 的申請`}
            onPress={() => updateRequest(request.id, pending ? 'accepted' : 'pending')}
            style={({ pressed }) => [styles.decisionButton, pending ? styles.acceptButton : accepted ? styles.acceptedButton : styles.deletedButton, pressed && styles.decisionPressed]}
          >
            <Text style={[styles.decisionText, pending ? styles.acceptText : accepted ? styles.acceptedText : styles.deletedText]}>{pending ? '接受' : accepted ? '已接受' : '已刪除'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function InterestedOrders() {
  const posts = useAppStore((state) => state.posts);
  const ids = useAppStore((state) => state.interestedPostIds);
  const startConversation = useAppStore((state) => state.startConversation);
  const items = posts.filter((post) => ids.includes(post.id));
  if (!items.length) return <EmptyState icon="account-search-outline" title="尚未對任何拼單表示興趣" />;
  return (
    <FlatList
      style={styles.interestedScroll}
      data={items}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.interestedList}
      renderItem={({ item }) => (
        <View style={styles.interestedRow}>
          <Pressable accessibilityRole="button" accessibilityLabel={`查看 ${item.name} 的拼單`} onPress={() => router.push(`/post/${item.id}`)} style={styles.interestedButton}>
            <Avatar name={item.name} badge={item.badge} size={54} />
            <View style={styles.requestText}>
              <Text numberOfLines={1} style={styles.interestedName}>{item.name}</Text>
              <Text numberOfLines={1} style={styles.preview}>{item.content}</Text>
              <Text style={styles.requestMeta}>{item.badge} Lv.{item.level}</Text>
            </View>
          </Pressable>
          <IconButton icon="message-outline" label={`傳訊息給 ${item.name}`} onPress={() => router.push(`/chat/${startConversation(item.name, item.badge, item.level)}`)} />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  tabs: { height: 48, flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: colors.yellow },
  tabText: { color: colors.muted, fontFamily: typography.regular, fontSize: 15 },
  activeTabText: { color: colors.ink, fontWeight: '700' },
  list: { padding: spacing.lg, paddingBottom: 120 },
  group: { marginBottom: spacing.xl },
  groupHeader: { minHeight: 54, flexDirection: 'row', alignItems: 'center' },
  groupTitle: { color: colors.ink, fontFamily: typography.rounded, fontSize: 17, lineHeight: 24, fontWeight: '700' },
  date: { marginTop: 4, color: colors.muted, fontSize: 13, lineHeight: 19 },
  viewAll: { color: colors.brown, fontFamily: typography.rounded, fontSize: 14, fontWeight: '700' },
  requestBox: { overflow: 'hidden', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  requestRow: { minHeight: 76, paddingVertical: 10, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 9 },
  requestDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  requestText: { flex: 1, minWidth: 0 },
  requestName: { color: colors.ink, fontFamily: typography.rounded, fontSize: 15, lineHeight: 22, fontWeight: '700' },
  requestMeta: { marginTop: 3, color: colors.muted, fontFamily: typography.regular, fontSize: 13, lineHeight: 19 },
  requestActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  decisionButton: { width: 64, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  decisionPlaceholder: { width: 64, height: 36 },
  decisionText: { color: colors.muted, fontFamily: typography.regular, fontSize: 15, lineHeight: 21, fontWeight: '700' },
  acceptButton: { backgroundColor: colors.yellow },
  acceptText: { color: colors.ink },
  acceptedButton: { backgroundColor: '#E8F4EC' },
  acceptedText: { color: colors.success },
  deletedButton: { backgroundColor: '#FCECEC' },
  deletedText: { color: colors.danger },
  decisionPressed: { opacity: 0.6 },
  interestedScroll: { flex: 1 },
  interestedList: { paddingBottom: 120 },
  interestedRow: { minHeight: 88, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  interestedButton: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  interestedName: { color: colors.ink, fontFamily: typography.rounded, fontSize: 16, fontWeight: '600' },
  preview: { marginTop: 4, color: colors.muted, fontFamily: typography.regular, fontSize: 15, lineHeight: 22 },
});
