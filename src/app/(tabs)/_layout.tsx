import { Tabs } from 'expo-router';
import { GlassTabBar } from '@/components/glass-tab-bar';
import { selectPendingCount, selectUnreadCount, useAppStore } from '@/store/app-store';
import { CORE_API_ENABLED } from '@/lib/core-api';
import { useCoreChatActivity } from '@/lib/core-chat-hooks';
import { useStealthBadge } from '@/lib/notification-badge';

export default function TabLayout() {
  const pending = useAppStore(selectPendingCount);
  const unread = useAppStore(selectUnreadCount);
  const activity = useCoreChatActivity();
  const stealthBadge = useStealthBadge();
  return (
    <Tabs tabBar={(props) => <GlassTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: '首頁' }} />
      <Tabs.Screen
        name="orders"
        options={{
          title: '拼單',
          tabBarBadge:
            (CORE_API_ENABLED
              ? (activity.data?.pending_requests ?? 0) + (activity.data?.accepted_requests ?? 0)
              : pending) || undefined,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: '新增貼文',
          tabBarBadge: stealthBadge.count || undefined,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: '訊息',
          tabBarBadge: (CORE_API_ENABLED ? activity.data?.total_unread : unread) || undefined,
        }}
      />
      <Tabs.Screen name="profile" options={{ title: '個人檔案' }} />
    </Tabs>
  );
}
