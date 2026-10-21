import { useEffect, useState, type PropsWithChildren } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '@/components/app-text';
import { PrimaryButton, Screen } from '@/components/primitives';
import { CORE_API_ENABLED, CORE_SUPABASE_MODE, coreError } from '@/lib/core-api';
import { beginGoogleSignIn, clearGoogleCallback } from '@/lib/google-login';
import { onUnauthorized } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { useAppStore } from '@/store/app-store';
import { colors, radius, spacing } from '@/theme/tokens';
import { AccountDeletionRecovery } from '@/components/core-account-deletion';
import { APPLE_INTAKE_TRIAL } from '@/lib/apple-intake';
import { AppleIntakeTrialScreen } from '@/components/apple-intake-trial';
import { isExpoGo } from '@/lib/app-runtime';
import { CoreConnectionStatus } from '@/components/core-connection-status';

export function CoreAuthGate({ children }: PropsWithChildren) {
  if (APPLE_INTAKE_TRIAL) return <AppleIntakeTrialScreen />;
  if (!CORE_API_ENABLED) return children;
  return <LocalAuthGate>{children}</LocalAuthGate>;
}

function LocalAuthGate({ children }: PropsWithChildren) {
  const { user, busy, error, restore, logout } = useAuthStore();
  useEffect(() => { void restore(); }, [restore]);
  useEffect(() => onUnauthorized(() => { void useAuthStore.getState().expireSession(); }), []);
  const userId = user?.id;
  useEffect(() => {
    // Clear account-owned UI state only when identity changes, not on profile edits.
    useAppStore.setState({ posts: [], interestedPostIds: [], requests: [], history: [] });
  }, [userId]);
  useEffect(() => {
    if (user) useAppStore.setState({ currentUser: {
      name: user.display_name, badge: user.badge ?? '🍱', bio: user.bio ?? '',
      joinedAt: new Date(user.created_at).toLocaleDateString('zh-TW'),
    } });
  }, [user]);
  return <View style={{ flex: 1 }}>
    {user ? <View style={styles.banner}>
      <View style={{ flex: 1 }}><Text style={styles.bannerText}>{user.auth_mode === 'supabase' ? 'Supabase 開發版' : '本機測試'} · {user.display_name}</Text><Text style={styles.hint}>{user.auth_mode === 'supabase' ? '帳號、拼單、圖片、聊天與偷揪已連線；語音尚未串接' : '登入與拼單已連線，其餘功能為展示版'}</Text></View>
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => { void logout(); }}><Text style={styles.link}>登出</Text></Pressable>
    </View> : null}
    {user && error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <View style={{ flex: 1 }}>{user?.deletion_pending ? <AccountDeletionRecovery /> : children}</View>
  </View>;
}

export function CoreLoginScreen() {
  const ready = useAuthStore((state) => state.ready);
  if (!ready) return <Screen><ActivityIndicator accessibilityLabel="正在確認登入" /></Screen>;
  return <LoginForm />;
}

function LoginForm() {
  const expoGo = isExpoGo();
  const accountDeleted = useAuthStore(state => state.accountDeleted);
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
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && password.length >= 10 && password.length <= 128
    && (mode === 'login' || !!name.trim());
  async function submit() {
    if (await authenticate(mode, email, password, name)) setPassword('');
  }
  async function googleLogin() {
    setGoogleBusy(true); setGoogleError('');
    try {
      const session = await beginGoogleSignIn();
      if (session && !await useAuthStore.getState().acceptGoogleSession(session)) throw new Error('google_login_expired_restart');
      if (session) { clearGoogleCallback(); setGoogleBusy(false); }
    }
    catch (error) { setGoogleError(coreError(error)); setGoogleBusy(false); }
  }
  return <Screen scroll style={styles.form}>
    <Text style={styles.title}>政缺一咖</Text>
    {accountDeleted ? <Text accessibilityRole="alert" style={styles.hint}>App 帳號已刪除。再次使用 Google 登入會建立新帳號，舊資料不會恢復。</Text> : null}
    <Text style={styles.subtitle}>{mode === 'login' ? CORE_SUPABASE_MODE ? '登入 Supabase 開發帳號' : '登入本機測試帳號' : CORE_SUPABASE_MODE ? '建立 Supabase 開發帳號' : '建立本機測試帳號'}</Text>
    <Text style={styles.hint}>{CORE_SUPABASE_MODE ? '程式在本機執行，帳號與拼單存於 Supabase 開發專案。註冊後需依設定完成信箱驗證，請使用專用測試密碼。' : '帳號只儲存在這台電腦，不會寄送驗證信。請用測試信箱及專用密碼。'}</Text>
    {expoGo && CORE_SUPABASE_MODE ? <View style={{ gap: spacing.sm }}>
      <Text style={styles.hint}>Expo Go 測試：請用信箱與 App 專用密碼登入，可測拼單、聊天與偷揪。Google 登入及 Apple 裝置 AI 留在原生開發版；這裡的需求訪談由電腦本機模型提供。</Text>
      <Text style={styles.hint}>Google 帳號的密碼不能當作 App 密碼。新信箱仍需完成驗證；不會略過驗證。</Text>
      <Text style={styles.hint}>原本只用 Google 登入？請先在電腦的帳號設定入口用 Google 登入，再設定 App 密碼。同信箱重複註冊不會替既有帳號設定密碼。</Text>
      <CoreConnectionStatus />
    </View> : null}
    {CORE_SUPABASE_MODE && !expoGo ? <View style={{ gap: spacing.sm }}>
      <PrimaryButton secondary disabled={busy || googleBusy || !['web', 'ios'].includes(Platform.OS)} onPress={() => { void googleLogin(); }}>{googleBusy ? '正在前往 Google…' : '使用 Google 帳號登入'}</PrimaryButton>
      <Text style={styles.hint}>{Platform.OS === 'web' ? '首次使用會建立 App 帳號，無須另外設定 App 密碼。' : 'iPhone 需使用開發版本，並先完成 App 回呼網址設定。'}</Text>
      {googleError ? <Text accessibilityRole="alert" style={styles.error}>{googleError}</Text> : null}
    </View> : null}
    {mode === 'register' ? <TextInput accessibilityLabel="顯示名稱" placeholder="顯示名稱" value={name} onChangeText={setName} maxLength={40} style={styles.input} /> : null}
    <TextInput accessibilityLabel="信箱" placeholder={CORE_SUPABASE_MODE ? '能收到驗證信的真實信箱' : '例如 alice@example.test'} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} maxLength={254} style={styles.input} />
    <TextInput accessibilityLabel="密碼" placeholder="密碼（至少 10 字）" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} maxLength={128} style={styles.input} onSubmitEditing={() => { if (valid && !busy && !googleBusy) void submit(); }} />
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <PrimaryButton disabled={!valid || busy || googleBusy} onPress={() => { void submit(); }}>{busy ? '處理中…' : mode === 'login' ? '登入' : CORE_SUPABASE_MODE ? '註冊（需驗證信箱）' : '註冊並登入'}</PrimaryButton>
    <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setMode(mode === 'login' ? 'register' : 'login'); setPassword(''); }}><Text style={styles.link}>{mode === 'login' ? '沒有測試帳號？建立帳號' : '已有帳號？返回登入'}</Text></Pressable>
    {error ? <PrimaryButton secondary disabled={busy} onPress={() => { void restore(); }}>重試連線與恢復登入</PrimaryButton> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  form: { flexGrow: 1, padding: spacing.xl, gap: spacing.md, justifyContent: 'center', width: '100%', maxWidth: 480, alignSelf: 'center' },
  title: { fontSize: 30, fontWeight: '800', color: colors.ink },
  subtitle: { fontSize: 20, fontWeight: '700', color: colors.ink },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, color: colors.ink, backgroundColor: colors.background },
  error: { color: colors.danger, padding: spacing.sm, fontSize: 14 },
  link: { color: colors.brown, padding: spacing.sm, fontWeight: '700' },
  banner: { paddingHorizontal: spacing.md, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface },
  bannerText: { color: colors.ink, fontSize: 13, fontWeight: '700' },
});
