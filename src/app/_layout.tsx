import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { queryClient } from '@/lib/query-client';
import { colors } from '@/theme/tokens';
import { AppDrawer } from '@/components/app-drawer';
import { CoreAuthGate } from '@/components/core-auth-gate';
import { CORE_API_ENABLED } from '@/lib/core-api';
import { useAuthStore } from '@/store/auth-store';
import { ActivityIndicator } from 'react-native';
import { Screen } from '@/components/primitives';

export default function RootLayout() {
  const user = useAuthStore((state) => state.user);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" />
          <CoreAuthGate>
          <RootNavigator />
          {!CORE_API_ENABLED || user ? <AppDrawer /> : null}
          </CoreAuthGate>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const { user, ready } = useAuthStore();
  if (CORE_API_ENABLED && !ready) return <Screen><ActivityIndicator accessibilityLabel="正在確認登入" /></Screen>;
  const allowed = !CORE_API_ENABLED || !!user;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
    <Stack.Protected guard={allowed}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="chat/[id]" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="post/[id]" />
      <Stack.Screen name="order/[id]" />
      <Stack.Screen name="user/[name]" />
      <Stack.Screen name="search" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="edit-profile" />
      <Stack.Screen name="edit-post/[id]" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="help" />
      <Stack.Screen name="font-size" />
      <Stack.Screen name="preferences" />
      <Stack.Screen name="stealth" />
    </Stack.Protected>
    <Stack.Protected guard={CORE_API_ENABLED && !user}>
      <Stack.Screen name="sign-in" />
    </Stack.Protected>
    <Stack.Screen name="auth/callback" />
  </Stack>;
}
