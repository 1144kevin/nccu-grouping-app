import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/app-text';
import { AppHeader, Avatar, EmptyState, Screen, SectionTitle } from '@/components/primitives';
import { CorePostRow } from '@/components/list-ui';
import { useCorePosts } from '@/lib/core-hooks';
import { useAuthStore } from '@/store/auth-store';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export function CoreProfileScreen() {
  const user = useAuthStore((state) => state.user);
  const history = useCorePosts('history');
  if (!user) return null;
  return (
    <Screen>
      <AppHeader searchScope="history" />
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="編輯個人資料"
          onPress={() => router.push('/edit-profile')}
          style={styles.identity}
        >
          <Avatar name={user.display_name} badge={user.badge ?? '🍱'} size={76} />
          <View style={styles.identityText}>
            <Text style={styles.username}>{user.display_name}</Text>
            <Text style={styles.joined}>
              {new Date(user.created_at).toLocaleDateString('zh-TW')} 加入
            </Text>
            <Text numberOfLines={2} style={styles.bio}>
              {user.bio || '寫點介紹，讓夥伴認識你'}
            </Text>
          </View>
          <MaterialCommunityIcons name="pencil-outline" size={18} color={colors.subtle} />
        </Pressable>
        <SectionTitle
          action={
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/orders', params: { scope: 'history' } })}
            >
              <Text style={styles.link}>查看全部</Text>
            </Pressable>
          }
        >
          過往拼單
        </SectionTitle>
        {history.isPending ? (
          <ActivityIndicator />
        ) : history.posts.length ? (
          history.posts.slice(0, 3).map((post) => <CorePostRow key={post.id} post={post} order />)
        ) : (
          <EmptyState icon="clipboard-text-outline" title="還沒有過往拼單" />
        )}
        <Pressable onPress={() => router.push('/settings')} style={styles.settingsButton}>
          <MaterialCommunityIcons name="shield-account-outline" size={18} color={colors.ink} />
          <Text style={styles.settingsText}>帳號與隱私設定</Text>
          <MaterialCommunityIcons name="chevron-right" size={17} color={colors.subtle} />
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 120 },
  identity: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xl },
  identityText: { flex: 1, marginLeft: 14 },
  username: { color: colors.ink, fontFamily: typography.rounded, fontSize: 22, fontWeight: '800' },
  joined: { marginTop: 4, color: colors.muted, fontSize: 13 },
  bio: { marginTop: 8, color: colors.muted, fontSize: 14, lineHeight: 21 },
  link: { color: colors.brown, fontSize: 14, padding: 8, fontWeight: '700' },
  settingsButton: {
    minHeight: 50,
    marginTop: 16,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  settingsText: { flex: 1, color: colors.ink, fontSize: 15, fontWeight: '700' },
});
