import { AppText as Text } from '@/components/app-text';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { type Href, router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { DetailHeader, EmptyState, IconButton, Screen } from '@/components/primitives';
import { useAppStore } from '@/store/app-store';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export default function NotificationsScreen() {
  const notifications = useAppStore((state) => state.notifications);
  const markRead = useAppStore((state) => state.markNotificationRead);
  const markAllRead = useAppStore((state) => state.markAllNotificationsRead);
  const unread = notifications.filter((item) => !item.read).length;
  return <Screen><DetailHeader title="通知中心" right={unread ? <IconButton icon="check-all" label="全部標為已讀" onPress={markAllRead} /> : undefined} /><FlatList data={notifications} keyExtractor={(item) => item.id} contentContainerStyle={notifications.length ? styles.list : styles.emptyList} ListHeaderComponent={<Text style={styles.summary}>{unread ? `${unread} 則未讀通知` : '所有通知都已讀'}</Text>} ListEmptyComponent={<EmptyState icon="bell-sleep-outline" title="目前沒有通知" />} renderItem={({ item }) => <Pressable onPress={() => { markRead(item.id); router.push(item.target as Href); }} style={({ pressed }) => [styles.row, !item.read && styles.unreadRow, pressed && styles.pressed]}><View style={styles.icon}><MaterialCommunityIcons name={item.icon as React.ComponentProps<typeof MaterialCommunityIcons>['name']} size={20} color={colors.ink} /></View><View style={styles.text}><View style={styles.titleRow}><Text style={[styles.title, !item.read && styles.unreadTitle]}>{item.title}</Text><Text style={styles.time}>{item.time}</Text></View><Text style={styles.body}>{item.body}</Text></View>{!item.read ? <View style={styles.dot} /> : null}</Pressable>} /></Screen>;
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  emptyList: { flexGrow: 1 },
  summary: { paddingVertical: spacing.md, color: colors.muted, fontSize: 13 },
  row: { minHeight: 82, marginBottom: spacing.sm, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  unreadRow: { borderColor: '#E8CA54', backgroundColor: '#FFFDF3' },
  icon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: colors.yellowSoft },
  text: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1, color: colors.ink, fontFamily: typography.rounded, fontSize: 15, fontWeight: '600' },
  unreadTitle: { fontWeight: '800' },
  time: { color: colors.subtle, fontSize: 12 },
  body: { marginTop: 5, color: colors.muted, fontSize: 15, lineHeight: 23 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.yellow },
  pressed: { opacity: 0.65 },
});
