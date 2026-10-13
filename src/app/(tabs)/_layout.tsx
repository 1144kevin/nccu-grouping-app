import { Tabs } from 'expo-router';
import { GlassTabBar } from '@/components/glass-tab-bar';
import { selectPendingCount, selectUnreadCount, useAppStore } from '@/store/app-store';

export default function TabLayout() {
  const pending = useAppStore(selectPendingCount);
  const unread = useAppStore(selectUnreadCount);
  return (
    <Tabs tabBar={(props) => <GlassTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: '首頁' }} />
      <Tabs.Screen name="orders" options={{ title: '拼單', tabBarBadge: pending || undefined }} />
      <Tabs.Screen name="create" options={{ title: '新增貼文' }} />
      <Tabs.Screen name="messages" options={{ title: '訊息', tabBarBadge: unread || undefined }} />
      <Tabs.Screen name="profile" options={{ title: '個人檔案' }} />
    </Tabs>
  );
}
