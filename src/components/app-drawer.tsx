import { BrandLogo } from '@/components/brand-logo';
import { AppText as Text } from '@/components/app-text';
import { Avatar } from '@/components/primitives';
import { selectUnreadNotificationCount, useAppStore } from '@/store/app-store';
import { useNavigationStore } from '@/store/navigation-store';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { type Href, router } from 'expo-router';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CORE_API_ENABLED, CORE_SUPABASE_MODE } from '@/lib/core-api';
import { useAuthStore } from '@/store/auth-store';

const supportItems = [
  { label: 'App 字級', icon: 'format-size', href: '/font-size' },
  { label: '通知中心', icon: 'bell-outline', href: '/notifications' },
  { label: '推薦偏好', icon: 'tune-variant', href: '/preferences' },
  { label: '帳號與隱私', icon: 'shield-account-outline', href: '/settings' },
  { label: '幫助與回報', icon: 'help-circle-outline', href: '/help' },
] as const;

export function AppDrawer() {
  const insets = useSafeAreaInsets();
  const visible = useNavigationStore((state) => state.drawerOpen);
  const close = useNavigationStore((state) => state.closeDrawer);
  const unreadNotifications = useAppStore(selectUnreadNotificationCount);
  const { logout, busy, error } = useAuthStore();
  const currentUser = useAppStore((state) => state.currentUser);

  function navigate(href: string) {
    close();
    requestAnimationFrame(() => router.push(href as Href));
  }

  return (
    <Modal animationType="fade" onRequestClose={close} transparent visible={visible}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.panel,
            {
              paddingTop: Math.max(insets.top, spacing.xxl) + spacing.sm,
              paddingBottom: insets.bottom,
            },
          ]}
        >
          <View style={styles.topBar}>
            <View style={styles.brand}>
              <BrandLogo size={28} />
              <Text style={styles.brandText}>政缺一咖</Text>
            </View>
            <Pressable
              accessibilityLabel="關閉選單"
              accessibilityRole="button"
              onPress={close}
              style={styles.closeButton}
            >
              <MaterialCommunityIcons name="close" size={20} color={colors.ink} />
            </Pressable>
          </View>
          <View style={styles.account}>
            <Avatar name={currentUser.name} badge={currentUser.badge} size={52} />
            <View style={styles.accountText}>
              <Text style={styles.name}>{currentUser.name}</Text>
              <Text style={styles.level}>
                {CORE_API_ENABLED ? '已登入' : `${currentUser.badge} 五分熟 · Lv.5`}
              </Text>
            </View>
          </View>
          <ScrollView contentContainerStyle={styles.items}>
            {CORE_API_ENABLED && CORE_SUPABASE_MODE ? (
              <DrawerItem
                label="偷揪 · 我的 AI 分身"
                icon="robot-outline"
                onPress={() => navigate('/stealth')}
              />
            ) : null}
            <View style={styles.divider} />
            {supportItems.map((item) => (
              <DrawerItem
                key={item.label}
                {...item}
                label={
                  item.href === '/notifications' && CORE_API_ENABLED && CORE_SUPABASE_MODE
                    ? '拼單動態'
                    : item.label
                }
                badge={
                  item.href === '/notifications' && !CORE_API_ENABLED
                    ? unreadNotifications
                    : undefined
                }
                onPress={() => navigate(item.href)}
              />
            ))}
          </ScrollView>
          {CORE_API_ENABLED ? (
            <View style={styles.logout}>
              {error ? (
                <Text accessibilityRole="alert" style={{ color: colors.danger }}>
                  {error}
                </Text>
              ) : null}
              <DrawerItem
                label={busy ? '登出中…' : '登出帳號'}
                icon="logout"
                disabled={busy}
                onPress={() => {
                  close();
                  void logout();
                }}
              />
            </View>
          ) : null}
        </View>
        <Pressable accessibilityLabel="關閉選單背景" onPress={close} style={styles.backdrop} />
      </View>
    </Modal>
  );
}

function DrawerItem({
  label,
  icon,
  badge,
  onPress,
  disabled,
}: {
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  badge?: number;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.item, pressed && styles.pressed]}
    >
      <MaterialCommunityIcons name={icon} size={20} color={colors.ink} />
      <Text style={styles.itemText}>{label}</Text>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
      <MaterialCommunityIcons name="chevron-right" size={17} color={colors.subtle} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    flexDirection: 'row',
    backgroundColor: '#00000042',
  },
  panel: {
    width: '82%',
    maxWidth: 340,
    backgroundColor: colors.background,
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 4, height: 0 },
    elevation: 10,
  },
  backdrop: { flex: 1 },
  topBar: { height: 48, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center' },
  brand: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  brandText: { color: colors.ink, fontFamily: typography.rounded, fontSize: 17, fontWeight: '800' },
  closeButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  account: {
    margin: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  accountText: { flex: 1, marginLeft: spacing.md },
  name: { color: colors.ink, fontFamily: typography.rounded, fontSize: 15, fontWeight: '700' },
  level: { marginTop: 4, color: colors.brown, fontSize: 13 },
  items: { paddingHorizontal: spacing.sm },
  item: {
    minHeight: 50,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.md,
  },
  itemText: { flex: 1, color: colors.ink, fontFamily: typography.regular, fontSize: 16 },
  pressed: { backgroundColor: colors.surface },
  divider: {
    height: 1,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    backgroundColor: colors.border,
  },
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: colors.yellow,
  },
  badgeText: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  logout: {
    marginTop: 'auto',
    padding: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
