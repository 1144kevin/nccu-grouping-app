import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '@/components/app-text';
import { DetailHeader, PrimaryButton, Screen } from '@/components/primitives';
import { coreApi, coreError } from '@/lib/core-api';
import { useAuthStore } from '@/store/auth-store';
import { colors, radius, spacing } from '@/theme/tokens';

export function CoreAppPasswordScreen() {
  const user = useAuthStore(state => state.user);
  return <Screen scroll><DetailHeader title="設定 App 密碼" />
    {user?.auth_mode === 'supabase' ? <PasswordForm key={user.id} actor={user.id} email={user.email} />
      : <Text>請先用 Google 登入你的 Supabase 帳號。</Text>}
  </Screen>;
}

function PasswordForm({ actor, email }: { actor: string; email: string }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const valid = password.length >= 10 && password.length <= 128 && password === confirmation;
  async function save() {
    if (!valid || busy || useAuthStore.getState().user?.id !== actor) return;
    setBusy(true); setMessage('');
    try {
      await coreApi.setAppPassword(password, actor);
      if (useAuthStore.getState().user?.id !== actor) return;
      setPassword(''); setConfirmation('');
      setMessage('App 密碼已設定。請回 Expo Go，用畫面上的同一信箱與剛設定的密碼登入。');
    } catch (error) {
      if (useAuthStore.getState().user?.id === actor) setMessage(coreError(error));
    } finally { setBusy(false); }
  }
  return <View style={styles.content}>
    <Text>{email}</Text>
    <Text>請設定 10–128 字的 App 專用密碼，勿使用 Google 密碼。這會設定或更新此 App 帳號的密碼，Google 登入與既有拼單資料會保留。</Text>
    <TextInput accessibilityLabel="新 App 密碼" placeholder="新 App 密碼（至少 10 字）" secureTextEntry autoCapitalize="none" autoCorrect={false} maxLength={128} editable={!busy} value={password} onChangeText={setPassword} style={styles.input} />
    <TextInput accessibilityLabel="再次輸入 App 密碼" placeholder="再次輸入 App 密碼" secureTextEntry autoCapitalize="none" autoCorrect={false} maxLength={128} editable={!busy} value={confirmation} onChangeText={setConfirmation} style={styles.input} />
    {confirmation && password !== confirmation ? <Text>兩次輸入的密碼不一致。</Text> : null}
    <PrimaryButton disabled={!valid || busy} onPress={() => { void save(); }}>{busy ? '設定中…' : '確認設定 App 密碼'}</PrimaryButton>
    {message ? <Text accessibilityRole="alert">{message}</Text> : null}
    <Text>密碼不會放進網址或儲存在裝置設定；請只在此畫面輸入，不要貼到聊天。</Text>
  </View>;
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
});
