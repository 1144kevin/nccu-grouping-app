import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/app-text';
import { AppHeader, Avatar, PrimaryButton, Screen, SectionTitle } from '@/components/primitives';
import { useAuthStore } from '@/store/auth-store';
import { colors, spacing } from '@/theme/tokens';

export function CoreProfileScreen() {
  const { user, busy, error, logout } = useAuthStore();
  if (!user) return null;
  return <Screen>
    <AppHeader title="個人檔案" />
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.row}><Avatar name={user.display_name} badge={user.badge ?? '🍱'} size={72} /><View style={{ flex: 1 }}><Text style={styles.title}>{user.display_name}</Text><Text style={styles.hint}>{user.email}</Text></View></View>
      <Text style={styles.hint}>{user.bio || '尚未填寫個人介紹'}</Text>
      <PrimaryButton secondary onPress={() => router.push('/edit-profile')}>編輯個人資料</PrimaryButton>
      <Text style={styles.hint}>建立日期：{new Date(user.created_at).toLocaleDateString('zh-TW')}</Text>
      <Text style={styles.hint}>{user.auth_mode === 'supabase' ? 'Supabase 開發帳號' : '本機測試帳號'} · {user.email_verified ? '信箱已驗證' : '信箱尚未驗證'}</Text>
      <SectionTitle>拼單紀錄</SectionTitle>
      <PrimaryButton onPress={() => router.push('/orders')}>查看我主揪與參與的拼單</PrimaryButton>
      <PrimaryButton secondary onPress={() => router.push({ pathname: '/orders', params: { scope: 'history' } })}>查看過往拼單紀錄</PrimaryButton>
      <Text style={styles.hint}>熟度等級尚未接入本機後端。</Text>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <PrimaryButton secondary disabled={busy} onPress={() => { void logout(); }}>登出帳號</PrimaryButton>
    </ScrollView>
  </Screen>;
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 120 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { color: colors.ink, fontSize: 22, fontWeight: '700' },
  hint: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  error: { color: colors.danger, fontSize: 14 },
});
