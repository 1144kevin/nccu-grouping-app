import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { selectPendingCount, selectUnreadCount, useAppStore } from '@/store/app-store';
import { colors, typography } from '@/theme/tokens';

function TabIcon({ name, focused, create = false }: { name: React.ComponentProps<typeof MaterialCommunityIcons>['name']; focused: boolean; create?: boolean }) {
  if (create) return <View style={styles.createButton}><MaterialCommunityIcons name="plus" size={25} color="#FFFFFF" /></View>;
  return <MaterialCommunityIcons name={name} size={21} color={focused ? colors.ink : colors.muted} />;
}

export default function TabLayout() {
  const pending = useAppStore(selectPendingCount);
  const unread = useAppStore(selectUnreadCount);
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.ink, tabBarInactiveTintColor: colors.muted, tabBarLabelStyle: styles.label, tabBarStyle: styles.bar, tabBarHideOnKeyboard: true }}>
      <Tabs.Screen name="index" options={{ title: '首頁', tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'home' : 'home-outline'} focused={focused} /> }} />
      <Tabs.Screen name="orders" options={{ title: '拼單', tabBarBadge: pending || undefined, tabBarBadgeStyle: styles.badge, tabBarIcon: ({ focused }) => <TabIcon name="format-list-bulleted" focused={focused} /> }} />
      <Tabs.Screen name="create" options={{ title: '', tabBarIcon: ({ focused }) => <TabIcon name="plus" focused={focused} create /> }} />
      <Tabs.Screen name="messages" options={{ title: '訊息', tabBarBadge: unread || undefined, tabBarBadgeStyle: styles.badge, tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'message' : 'message-outline'} focused={focused} /> }} />
      <Tabs.Screen name="profile" options={{ title: '個人檔案', tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'account' : 'account-outline'} focused={focused} /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: { width: '100%', maxWidth: 520, height: 76, paddingTop: 7, paddingBottom: 8, alignSelf: 'center', borderTopColor: colors.border, backgroundColor: colors.background },
  label: { fontFamily: typography.regular, fontSize: 10, letterSpacing: 0 },
  badge: { minWidth: 17, height: 17, fontSize: 9, lineHeight: 16, backgroundColor: '#E11D2E', color: '#FFFFFF' },
  createButton: { width: 42, height: 42, marginTop: 5, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.yellow },
});
