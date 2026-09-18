import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ScrollView, Pressable, StyleSheet, Text, View } from 'react-native';
import { DetailHeader, Screen } from '@/components/primitives';
import { useAppStore } from '@/store/app-store';
import { colors, radius, spacing, typography } from '@/theme/tokens';

const categories = ['甜點', '飲料', '便當', '披薩', '宵夜', '早餐', '生活用品', '課程活動'];
const locations = ['校門口', '東側門', '達賢圖書館', '商學院', '綜合院館', '宿舍區'];

export default function PreferencesScreen() {
  const selected = useAppStore((state) => state.preferredTags);
  const toggle = useAppStore((state) => state.togglePreferredTag);
  return <Screen><DetailHeader title="推薦偏好" /><ScrollView contentContainerStyle={styles.content}><Text style={styles.intro}>選擇你常參與的類型與地點，推薦排序會優先顯示相關拼單。</Text><PreferenceGroup icon="silverware-fork-knife" title="感興趣的類型" items={categories} selected={selected} onToggle={toggle} /><PreferenceGroup icon="map-marker-outline" title="常用取餐地點" items={locations} selected={selected} onToggle={toggle} /><View style={styles.note}><MaterialCommunityIcons name="creation-outline" size={18} color={colors.brown} /><Text style={styles.noteText}>偏好只影響排序，不會隱藏其他同校拼單。之後的互動也會持續調整推薦結果。</Text></View></ScrollView></Screen>;
}

function PreferenceGroup({ icon, title, items, selected, onToggle }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; title: string; items: string[]; selected: string[]; onToggle: (item: string) => void }) {
  return <View style={styles.group}><View style={styles.heading}><MaterialCommunityIcons name={icon} size={18} color={colors.yellow} /><Text style={styles.title}>{title}</Text></View><View style={styles.tags}>{items.map((item) => { const active = selected.includes(item); return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: active }} key={item} onPress={() => onToggle(item)} style={[styles.tag, active && styles.tagActive]}><Text style={styles.tagText}>{active ? '✓  ' : ''}{item}</Text></Pressable>; })}</View></View>;
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  intro: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  group: { marginTop: spacing.xl },
  heading: { marginBottom: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { color: colors.ink, fontFamily: typography.rounded, fontSize: 16, fontWeight: '700' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tag: { minHeight: 37, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill },
  tagActive: { borderColor: colors.yellow, backgroundColor: colors.yellowSoft },
  tagText: { color: colors.ink, fontSize: 12 },
  note: { marginTop: spacing.xl, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface },
  noteText: { flex: 1, color: colors.muted, fontSize: 11, lineHeight: 17 },
});
