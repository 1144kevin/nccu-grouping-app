import { Avatar } from '@/components/primitives';
import { selectUnreadNotificationCount, useAppStore } from '@/store/app-store';
import { useNavigationStore } from '@/store/navigation-store';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { type Href, router } from 'expo-router';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const mainItems = [
  { label: '首頁', icon: 'home-outline', href: '/' },
  { label: '我的拼單', icon: 'format-list-bulleted', href: '/orders' },
  { label: '訊息', icon: 'message-outline', href: '/messages' },
  { label: '個人檔案', icon: 'account-outline', href: '/profile' },
] as const;

const supportItems = [
  { label: '通知中心', icon: 'bell-outline', href: '/notifications' },
  { label: '推薦偏好', icon: 'tune-variant', href: '/preferences' },
  { label: '帳號與隱私', icon: 'shield-account-outline', href: '/settings' },
  { label: '幫助與回報', icon: 'help-circle-outline', href: '/help' },
] as const;

export function AppDrawer() {
  const visible = useNavigationStore((state) => state.drawerOpen);
  const close = useNavigationStore((state) => state.closeDrawer);
  const unreadNotifications = useAppStore(selectUnreadNotificationCount);
  const currentUser = useAppStore((state) => state.currentUser);

  function navigate(href: string) {
    close();
    requestAnimationFrame(() => router.push(href as Href));
  }

  return (
    <Modal animationType="fade" onRequestClose={close} transparent visible={visible}>
      <View style={styles.overlay}>
        <SafeAreaView edges={['top', 'bottom']} style={styles.panel}>
          <View style={styles.topBar}>
            <View style={styles.brand}>
              <MaterialCommunityIcons name="bowl-mix-outline" size={23} color={colors.ink} />
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
          <Pressable onPress={() => navigate('/profile')} style={styles.account}>
            <Avatar name={currentUser.name} badge={currentUser.badge} size={52} />
            <View style={styles.accountText}>
              <Text style={styles.name}>{currentUser.name}</Text>
              <Text style={styles.level}>{currentUser.badge} 五分熟 · Lv.5</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={18} color={colors.muted} />
          </Pressable>
          <ScrollView contentContainerStyle={styles.items}>
            {mainItems.map((item) => (
              <DrawerItem key={item.label} {...item} onPress={() => navigate(item.href)} />
            ))}
            <View style={styles.divider} />
            {supportItems.map((item) => (
              <DrawerItem
                key={item.label}
                {...item}
                badge={item.href === '/notifications' ? unreadNotifications : undefined}
                onPress={() => navigate(item.href)}
              />
            ))}
          </ScrollView>
          <Text style={styles.version}>政缺一咖 · Prototype 1.0</Text>
        </SafeAreaView>
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
}: {
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  badge?: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
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
    paddingTop: spacing.lg,
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
  level: { marginTop: 4, color: colors.brown, fontSize: 11 },
  items: { paddingHorizontal: spacing.sm },
  item: {
    minHeight: 50,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.md,
  },
  itemText: { flex: 1, color: colors.ink, fontFamily: typography.regular, fontSize: 14 },
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
  badgeText: { color: colors.ink, fontSize: 10, fontWeight: '700' },
  version: { marginTop: 'auto', padding: spacing.lg, color: colors.subtle, fontSize: 10 },
});
