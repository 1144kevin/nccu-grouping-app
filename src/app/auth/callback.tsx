import { PageLoading } from '@/components/page-loading';
import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';
import { AppText as Text } from '@/components/app-text';
import { PrimaryButton, Screen } from '@/components/primitives';
import { CORE_API_ENABLED, CORE_SUPABASE_MODE, coreError } from '@/lib/core-api';
import { clearGoogleCallback, finishGoogleSignIn } from '@/lib/google-login';
import { useAuthStore } from '@/store/auth-store';
import { colors, spacing } from '@/theme/tokens';

export default function GoogleCallbackScreen() {
  const accountWeb = process.env.EXPO_PUBLIC_ACCOUNT_WEB === 'true';
  const [error, setError] = useState(
    !CORE_API_ENABLED || !CORE_SUPABASE_MODE ? '請使用 Supabase 開發模式重新開始登入。' : '',
  );
  useEffect(() => {
    let active = true;
    if (!CORE_API_ENABLED || !CORE_SUPABASE_MODE) return;
    const destination = (needsProfile?: boolean) =>
      needsProfile ? '/edit-profile' : accountWeb ? '/app-password' : '/';
    const current = useAuthStore.getState().user;
    if (current) {
      router.replace(destination(current.profile_setup_required));
      return;
    }
    const timeout = setTimeout(() => {
      active = false;
      setError('登入確認逾時，請返回登入頁重新使用 Google 登入。');
    }, 30_000);
    const exchange = finishGoogleSignIn();
    // Do not navigate back to this same route while exchanging a single-use
    // code. Safari may remount it and discard the pending completion handler.
    void exchange
      .then(async (session) => {
        if (!active) return;
        const accepted = await useAuthStore.getState().acceptGoogleSession(session);
        if (!active) return;
        clearTimeout(timeout);
        clearGoogleCallback();
        if (accepted) router.replace(destination(session.user.profile_setup_required));
        else if (active) setError('登入狀態已改變或無法儲存，請返回登入頁重試。');
      })
      .catch((failure) => {
        if (active) {
          clearTimeout(timeout);
          clearGoogleCallback();
          setError(coreError(failure));
        }
      });
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [accountWeb]);
  return (
    <Screen>
      <View style={{ flex: 1, padding: spacing.xl, gap: spacing.md, justifyContent: 'center' }}>
        <Text style={{ fontSize: 24, color: colors.ink }}>Google 登入</Text>
        {error ? (
          <>
            <Text accessibilityRole="alert" style={{ color: colors.danger }}>
              {error}
            </Text>
            <PrimaryButton onPress={() => router.replace('/sign-in')}>返回登入頁</PrimaryButton>
          </>
        ) : (
          <>
            <PageLoading accessibilityLabel="正在確認 Google 登入" />
            <Text>正在確認身分，請稍候</Text>
          </>
        )}
      </View>
    </Screen>
  );
}
