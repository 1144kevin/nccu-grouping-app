import { useEffect, useRef, useState } from 'react';
import { AppLoadingPage } from '@/components/app-loading-page';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { AppearanceController } from '@/components/appearance-controller';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { queryClient } from '@/lib/query-client';
import { colors } from '@/theme/tokens';
import { AppDrawer } from '@/components/app-drawer';
import { CoreAuthGate } from '@/components/core-auth-gate';
import { CORE_API_ENABLED } from '@/lib/core-api';
import { prefetchHomeFeed } from '@/lib/engagement-api';
import { useAuthStore } from '@/store/auth-store';
import { Screen } from '@/components/primitives';
import { PostLoginReturn } from '@/components/post-login-return';
import { WebInputNavigation } from '@/components/web-input-navigation';
import { WebPushOnboarding } from '@/components/web-push-settings';
import { PizzaShowerProvider } from '@/components/pizza-shower';

export default function RootLayout() {
  const user = useAuthStore((state) => state.user);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <WebInputNavigation />
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <PizzaShowerProvider>
            <AppearanceController />
            <CoreAuthGate>
              <RootNavigator />
              {CORE_API_ENABLED ? <PostLoginReturn /> : null}
              {CORE_API_ENABLED && user && !user.profile_setup_required ? (
                <WebPushOnboarding key={user.id} />
              ) : null}
              {!CORE_API_ENABLED || (user && !user.profile_setup_required) ? <AppDrawer /> : null}
            </CoreAuthGate>
          </PizzaShowerProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const { user, ready: authReady } = useAuthStore();
  const userId = user?.id ?? '';
  const authenticated = !CORE_API_ENABLED || !!user;
  const allowed = authenticated && (!CORE_API_ENABLED || !user?.profile_setup_required);
  const canEnterFeed = CORE_API_ENABLED && allowed && !!user && !user.deletion_pending;

  const [gateState, setGateState] = useState<'booting' | 'entering' | 'done'>(() =>
    CORE_API_ENABLED ? 'booting' : 'done',
  );
  const [gateReady, setGateReady] = useState(false);
  const prevCanEnterRef = useRef<boolean | null>(null);
  const prefetchRunRef = useRef(0);

  useEffect(() => {
    if (!CORE_API_ENABLED || !authReady) return;
    const prev = prevCanEnterRef.current;
    prevCanEnterRef.current = canEnterFeed;
    if (prev === false && canEnterFeed) {
      setGateState('entering');
      setGateReady(false);
    }
  }, [authReady, canEnterFeed]);

  useEffect(() => {
    if (!CORE_API_ENABLED || !authReady || gateState === 'done') return;
    let active = true;
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
    const runId = ++prefetchRunRef.current;

    if (canEnterFeed && userId) {
      setGateReady(false);
      fallbackTimer = setTimeout(() => {
        if (active && prefetchRunRef.current === runId) setGateReady(true);
      }, 8000);
      void prefetchHomeFeed(queryClient, userId).finally(() => {
        clearTimeout(fallbackTimer);
        if (active && prefetchRunRef.current === runId) setGateReady(true);
      });
    } else {
      setGateReady(true);
    }

    return () => {
      active = false;
      clearTimeout(fallbackTimer);
    };
  }, [authReady, canEnterFeed, gateState, userId]);

  if (CORE_API_ENABLED && gateState !== 'done') {
    return (
      <Screen>
        <AppLoadingPage
          key={gateState}
          ready={gateReady}
          onComplete={() => setGateState('done')}
          accessibilityLabel={gateState === 'booting' ? '正在確認登入' : '正在載入首頁'}
        />
      </Screen>
    );
  }
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
    >
      <Stack.Protected guard={allowed}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="direct-chat/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="chat/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="post/[id]" />
        <Stack.Screen name="order/[id]" />
        <Stack.Screen name="user/[name]" />
        <Stack.Screen name="search" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="app-password" />
        <Stack.Screen name="edit-post/[id]" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="help" />
        <Stack.Screen name="font-size" />
        <Stack.Screen name="preferences" />
        <Stack.Screen name="stealth" />
        <Stack.Screen name="stealth-history" />
        <Stack.Screen name="stealth-preferences" />
        <Stack.Screen name="report" />
      </Stack.Protected>
      <Stack.Protected guard={authenticated}>
        <Stack.Screen
          name="edit-profile"
          options={{ gestureEnabled: !user?.profile_setup_required }}
        />
      </Stack.Protected>
      <Stack.Protected guard={CORE_API_ENABLED && !user}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Screen name="auth/callback" />
      <Stack.Screen name="s/[token]" />
    </Stack>
  );
}
