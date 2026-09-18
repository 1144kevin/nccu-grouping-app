import { useState } from 'react';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppHeader, Avatar, EmptyState, Screen } from '@/components/primitives';
import { useAppStore } from '@/store/app-store';
import type { InboxType } from '@/types/domain';
import { colors, typography } from '@/theme/tokens';

type InboxTab = 'all' | InboxType;

export default function MessagesScreen() {
  const conversations = useAppStore((state) => state.conversations);
  const markRead = useAppStore((state) => state.markRead);
  const [tab, setTab] = useState<InboxTab>('all');
  const items = conversations.filter((item) => tab === 'all' || item.inbox === tab);
  return (
    <Screen>
      <AppHeader searchScope="messages" />
      <View style={styles.tabs}>{(['all', 'primary', 'general'] as InboxTab[]).map((value) => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: tab === value }} onPress={() => setTab(value)} style={[styles.tab, tab === value && styles.activeTab]}><Text style={styles.tabText}>{value === 'all' ? '全部' : value === 'primary' ? '主要' : '一般'}</Text></Pressable>)}</View>
      <FlatList data={items} keyExtractor={(item) => item.id} ListEmptyComponent={<EmptyState icon="text-search" title="沒有符合的訊息" />} ListFooterComponent={items.length ? <Text style={styles.end}>已經到底了喔！</Text> : null} renderItem={({ item }) => <Pressable onPress={() => { markRead(item.id); router.push(`/chat/${item.id}`); }} style={styles.row}><View><Avatar name={item.name} badge={item.badge} size={54} />{item.unread && <View style={styles.unreadDot} />}</View><View style={styles.body}><View style={styles.nameRow}><Text numberOfLines={1} style={[styles.name, item.unread && styles.unread]}>{item.name}</Text><Text style={styles.level}>{item.badge} Lv.{item.level}</Text><Text style={styles.time}>{item.time}</Text></View><Text numberOfLines={1} style={[styles.preview, item.unread && styles.unreadPreview]}>{item.preview}</Text></View></Pressable>} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { height: 52, paddingHorizontal: 34, flexDirection: 'row', alignItems: 'center', gap: 9 },
  tab: { flex: 1, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17 },
  activeTab: { backgroundColor: colors.yellow },
  tabText: { color: colors.ink, fontFamily: typography.regular, fontSize: 13 },
  row: { minHeight: 78, marginHorizontal: 14, paddingHorizontal: 6, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
  unreadDot: { position: 'absolute', right: 0, top: 1, width: 8, height: 8, borderRadius: 4, borderWidth: 1, borderColor: colors.background, backgroundColor: colors.danger },
  body: { flex: 1, marginLeft: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { maxWidth: '55%', color: colors.ink, fontFamily: typography.rounded, fontSize: 14, fontWeight: '600' },
  unread: { fontWeight: '800' },
  level: { color: colors.muted, fontSize: 10 },
  time: { marginLeft: 'auto', color: colors.muted, fontSize: 10 },
  preview: { marginTop: 5, color: colors.muted, fontFamily: typography.regular, fontSize: 13 },
  unreadPreview: { color: colors.ink, fontWeight: '700' },
  end: { paddingVertical: 24, textAlign: 'center', color: colors.subtle, fontFamily: typography.regular, fontSize: 13 },
});
