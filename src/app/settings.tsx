import { AppText as Text } from '@/components/app-text';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { Avatar, DetailHeader, Screen } from '@/components/primitives';
import { useAppStore } from '@/store/app-store';
import { colors, spacing, typography } from '@/theme/tokens';

export default function SettingsScreen() {
  const settings = useAppStore((state) => state.notificationSettings);
  const updateSetting = useAppStore((state) => state.updateNotificationSetting);
  const blocked = useAppStore((state) => state.blockedUserNames);
  const toggleBlocked = useAppStore((state) => state.toggleBlockedUser);
  const currentUser = useAppStore((state) => state.currentUser);
  return <Screen><DetailHeader title="帳號與隱私" /><ScrollView contentContainerStyle={styles.content}><Text style={styles.section}>個人資料</Text><Pressable onPress={() => router.push('/edit-profile')} style={styles.row}><Avatar name={currentUser.name} badge={currentUser.badge} size={40} /><View style={styles.rowText}><Text style={styles.rowTitle}>{currentUser.name}</Text><Text style={styles.rowDetail}>編輯顯示名稱與個人介紹</Text></View><MaterialCommunityIcons name="chevron-right" size={17} color={colors.subtle} /></Pressable><Text style={styles.section}>通知</Text><ToggleRow title="拼單申請" detail="有人想加入你的拼單" value={settings.joinRequests} onValueChange={(value) => updateSetting('joinRequests', value)} /><ToggleRow title="新訊息" detail="聊天室收到新內容" value={settings.messages} onValueChange={(value) => updateSetting('messages', value)} /><ToggleRow title="推薦拼單" detail="符合興趣的新貼文" value={settings.recommendations} onValueChange={(value) => updateSetting('recommendations', value)} /><ToggleRow title="截止提醒" detail="拼單結束前提醒" value={settings.deadlineReminders} onValueChange={(value) => updateSetting('deadlineReminders', value)} /><Text style={styles.section}>隱私與安全</Text><View style={styles.row}><MaterialCommunityIcons name="account-cancel-outline" size={19} color={colors.ink} /><View style={styles.rowText}><Text style={styles.rowTitle}>封鎖名單</Text><Text style={styles.rowDetail}>{blocked.length ? `${blocked.length} 位使用者` : '目前沒有封鎖使用者'}</Text></View></View>{blocked.map((name) => <Pressable key={name} onPress={() => toggleBlocked(name)} style={styles.blockedRow}><Text style={styles.blockedName}>{name}</Text><Text style={styles.unblock}>解除封鎖</Text></Pressable>)}<Pressable onPress={() => Alert.alert('登出帳號？', '本機展示資料會保留。', [{ text: '取消', style: 'cancel' }, { text: '登出', style: 'destructive', onPress: () => Alert.alert('展示模式', '正式登入功能尚未連接後端。') }])} style={styles.logout}><Text style={styles.logoutText}>登出</Text></Pressable></ScrollView></Screen>;
}

function ToggleRow({ title, detail, value, onValueChange }: { title: string; detail: string; value: boolean; onValueChange: (value: boolean) => void }) { return <View style={styles.row}><View style={styles.rowText}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.rowDetail}>{detail}</Text></View><Switch trackColor={{ false: colors.border, true: '#F0CF4D' }} thumbColor={value ? colors.yellow : '#FFFFFF'} value={value} onValueChange={onValueChange} /></View>; }

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  section: { marginTop: spacing.xl, marginBottom: spacing.sm, color: colors.brown, fontFamily: typography.rounded, fontSize: 14, fontWeight: '700' },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowText: { flex: 1 },
  rowTitle: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  rowDetail: { marginTop: 4, color: colors.muted, fontSize: 13 },
  blockedRow: { minHeight: 46, paddingLeft: 31, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
  blockedName: { flex: 1, color: colors.ink, fontSize: 14 },
  unblock: { color: colors.brown, fontSize: 13, fontWeight: '700' },
  logout: { height: 46, marginTop: spacing.xl, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E6B9B9' },
  logoutText: { color: colors.danger, fontWeight: '700' },
});
