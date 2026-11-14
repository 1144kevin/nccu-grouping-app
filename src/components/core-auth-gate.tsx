import { AppLoadingPage } from '@/components/app-loading-page';
import { PageLoading } from '@/components/page-loading';
import { BrandLogo } from '@/components/brand-logo';
import { RegistrationTerms } from '@/components/registration-terms';
import { useEffect, useState, type PropsWithChildren } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '@/components/app-text';
import { PrimaryButton, Screen } from '@/components/primitives';
import { CORE_API_ENABLED, CORE_SUPABASE_MODE, coreError } from '@/lib/core-api';
import { beginGoogleSignIn, clearGoogleCallback } from '@/lib/google-login';
import { onUnauthorized } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { useAppStore } from '@/store/app-store';
import { colors, spacing, yellowSurface } from '@/theme/tokens';
import { AccountDeletionRecovery } from '@/components/core-account-deletion';
import { APPLE_INTAKE_TRIAL } from '@/lib/apple-intake';
import { AppleIntakeTrialScreen } from '@/components/apple-intake-trial';
import { isExpoGo } from '@/lib/app-runtime';

export function CoreAuthGate({ children }: PropsWithChildren) {
  if (APPLE_INTAKE_TRIAL) return <AppleIntakeTrialScreen />;
  if (!CORE_API_ENABLED) return children;
  return <LocalAuthGate>{children}</LocalAuthGate>;
}

function LocalAuthGate({ children }: PropsWithChildren) {
  const { user, error, restore } = useAuthStore();
  useEffect(() => {
    void restore();
  }, [restore]);
  useEffect(
    () =>
      onUnauthorized(() => {
        void useAuthStore.getState().expireSession();
      }),
    [],
  );
  const userId = user?.id;
  useEffect(() => {
    // Clear account-owned UI state only when identity changes, not on profile edits.
    useAppStore.setState({ posts: [], interestedPostIds: [], requests: [], history: [] });
  }, [userId]);
  useEffect(() => {
    if (user)
      useAppStore.setState({
        currentUser: {
          name: user.display_name,
          badge: user.badge ?? '🍱',
          bio: user.bio ?? '',
          joinedAt: new Date(user.created_at).toLocaleDateString('zh-TW'),
        },
      });
  }, [user]);
  return (
    <View style={{ flex: 1 }}>
      {user && error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      <View style={{ flex: 1 }}>
        {user?.deletion_pending ? <AccountDeletionRecovery /> : children}
      </View>
    </View>
  );
}

export function CoreLoginScreen() {
  const ready = useAuthStore((state) => state.ready);
  if (!ready)
    return (
      <Screen>
        <AppLoadingPage accessibilityLabel="正在確認登入" />
      </Screen>
    );
  return <LoginForm />;
}

function LoginForm() {
  const expoGo = isExpoGo();
  const accountDeleted = useAuthStore((state) => state.accountDeleted);
  const [agreed, setAgreed] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleError, setGoogleError] = useState('');
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const returnedToPage = () => setGoogleBusy(false);
    window.addEventListener('pageshow', returnedToPage);
    return () => window.removeEventListener('pageshow', returnedToPage);
  }, []);
  const { busy, error, authenticate, restore } = useAuthStore();
  const valid =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    password.length >= 10 &&
    password.length <= 128 &&
    (mode === 'login' || (!!name.trim() && agreed));
  async function submit() {
    if (await authenticate(mode, email, password, name)) setPassword('');
  }
  async function googleLogin() {
    if (!agreed) return;
    setGoogleBusy(true);
    setGoogleError('');
    try {
      const session = await beginGoogleSignIn();
      if (session && !(await useAuthStore.getState().acceptGoogleSession(session)))
        throw new Error('google_login_expired_restart');
      if (session) {
        clearGoogleCallback();
        setGoogleBusy(false);
      }
    } catch (error) {
      setGoogleError(coreError(error));
      setGoogleBusy(false);
    }
  }
  return (
    <Screen scroll style={styles.form}>
      <View style={styles.welcome}>
        <View style={styles.logoTile}>
          <BrandLogo size={54} onBrand />
        </View>
        <Text style={styles.title}>
          {mode === 'login' ? '一起揪，更有味' : '政缺一咖，正缺你這咖'}
        </Text>
        <Text style={styles.hint}>政缺一咖 · 和附近的人一起分享</Text>
      </View>
      {accountDeleted ? (
        <Text accessibilityRole="alert" style={styles.hint}>
          App 帳號已刪除。再次使用 Google 登入會建立新帳號，舊資料不會恢復。
        </Text>
      ) : null}
      <Text style={styles.subtitle}>{mode === 'login' ? '歡迎回來' : '建立帳號'}</Text>
      {expoGo && CORE_SUPABASE_MODE ? (
        <View style={{ gap: spacing.sm }}>
          <Text style={styles.hint}>請使用信箱與 App 密碼登入。</Text>
        </View>
      ) : null}
      {mode === 'register' || (CORE_SUPABASE_MODE && !expoGo) ? (
        <RegistrationTerms agreed={agreed} onChange={setAgreed} />
      ) : null}
      {CORE_SUPABASE_MODE && !expoGo ? (
        <View style={{ gap: spacing.sm }}>
          <PrimaryButton
            secondary
            disabled={busy || googleBusy || !agreed || !['web', 'ios'].includes(Platform.OS)}
            onPress={() => {
              void googleLogin();
            }}
            loading={googleBusy}
          >
            {googleBusy
              ? '正在前往 Google'
              : mode === 'register'
                ? '使用Google帳號註冊'
                : '使用 Google 帳號登入'}
          </PrimaryButton>
          <View style={styles.separator}>
            <View style={styles.rule} />
            <Text style={styles.hint}>或使用 Email</Text>
            <View style={styles.rule} />
          </View>
          {googleError ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {googleError}
            </Text>
          ) : null}
        </View>
      ) : null}
      {mode === 'register' ? (
        <TextInput
          accessibilityLabel="顯示名稱"
          placeholder="顯示名稱"
          value={name}
          onChangeText={setName}
          maxLength={40}
          style={styles.input}
        />
      ) : null}
      <TextInput
        accessibilityLabel="信箱"
        placeholder="電子信箱"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={254}
        style={styles.input}
      />
      <TextInput
        accessibilityLabel="密碼"
        placeholder="密碼（至少 10 字）"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={128}
        style={styles.input}
        onSubmitEditing={() => {
          if (valid && !busy && !googleBusy) void submit();
        }}
      />
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      <PrimaryButton
        disabled={!valid || busy || googleBusy}
        onPress={() => {
          void submit();
        }}
        loading={busy}
      >
        {busy
          ? '處理中'
          : mode === 'login'
            ? '登入'
            : CORE_SUPABASE_MODE
              ? '建立帳號'
              : '註冊並登入'}
      </PrimaryButton>
      <Pressable
        accessibilityRole="button"
        disabled={busy || googleBusy}
        onPress={() => {
          setMode(mode === 'login' ? 'register' : 'login');
          setPassword('');
        }}
      >
        <Text style={styles.link}>
          {mode === 'login' ? '還沒有帳號？立即註冊' : '已有帳號？返回登入'}
        </Text>
      </Pressable>
      {error ? (
        <PrimaryButton
          secondary
          disabled={busy}
          onPress={() => {
            void restore();
          }}
        >
          重試連線與恢復登入
        </PrimaryButton>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    flexGrow: 1,
    padding: spacing.xl,
    paddingTop: 56,
    paddingBottom: 40,
    gap: spacing.md,
    justifyContent: 'center',
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  welcome: { alignItems: 'center', gap: 12, marginBottom: 22 },
  logoTile: {
    width: 86,
    height: 86,
    borderRadius: 28,
    ...yellowSurface,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  separator: { flexDirection: 'row', alignItems: 'center', gap: 14, marginVertical: 14 },
  rule: { flex: 1, height: 1, backgroundColor: colors.border },
  title: { fontSize: 27, fontWeight: '800', color: colors.ink },
  subtitle: { fontSize: 20, fontWeight: '700', color: colors.ink },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  input: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    color: colors.ink,
    backgroundColor: colors.background,
  },
  error: { color: colors.danger, padding: spacing.sm, fontSize: 14 },
  link: { color: colors.brown, padding: spacing.sm, textAlign: 'center', fontWeight: '700' },
});
