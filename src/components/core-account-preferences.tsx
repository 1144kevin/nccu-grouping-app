import { PageLoading } from '@/components/page-loading';
import { WebPushSettings, sendPushConfirmation } from '@/components/web-push-settings';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { KeyboardScrollView as ScrollView } from '@/components/keyboard-layout';
import { AppText as Text, AppTextInput as TextInput } from '@/components/app-text';
import { Avatar, DetailHeader, PrimaryButton, Screen } from '@/components/primitives';
import { coreError } from '@/lib/core-api';
import {
  engagementApi,
  useAccountPreferences,
  type AccountPreferences,
  type NotificationPreferences,
} from '@/lib/engagement-api';
import { queryClient } from '@/lib/query-client';
import { useAuthStore } from '@/store/auth-store';
import { AccountDeletionPanel } from '@/components/core-account-deletion';
import { CloudBlockList } from '@/components/core-user-blocks';
import { colors, radius, spacing, yellowSurface } from '@/theme/tokens';

const options: [keyof NotificationPreferences, string, string][] = [
  ['joinRequests', '拼單申請提示', '顯示待審申請數'],
  ['messages', '聊天未讀提示', '顯示未讀訊息數'],
  ['recommendations', '推薦提示', '推薦與截止提醒'],
  ['stealthInvites', '偷揪邀請提示', 'App 內邀請提示'],
];
const tags = [
  '甜點',
  '飲料',
  '便當',
  '披薩',
  '宵夜',
  '早餐',
  '晚餐',
  '校門口',
  '東側門',
  '達賢圖書館',
  '商學院',
  '綜合院館',
  '宿舍區',
];

export function CoreAccountPreferences({ mode }: { mode: 'settings' | 'recommendations' }) {
  const user = useAuthStore((state) => state.user);
  const query = useAccountPreferences();
  return (
    <Screen>
      <DetailHeader title={mode === 'settings' ? '帳號與隱私' : '推薦偏好'} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        {mode === 'settings' && user ? (
          <>
            <View style={styles.row}>
              <Avatar
                name={user.display_name}
                badge={user.badge ?? '🍱'}
                userId={user.id}
                size={48}
              />
              <View>
                <Text style={styles.title}>{user.display_name}</Text>
                <Text style={styles.hint}>{user.email}</Text>
              </View>
            </View>
            <PrimaryButton secondary onPress={() => router.push('/edit-profile')}>
              編輯我的個人資料
            </PrimaryButton>
          </>
        ) : null}
        {query.isPending ? (
          <PageLoading />
        ) : query.data ? (
          <PreferencesForm key={`${user?.id}:${mode}`} initial={query.data} mode={mode} />
        ) : null}
        {query.error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {coreError(query.error)}
          </Text>
        ) : null}
        {mode === 'settings' ? (
          <>
            {user?.auth_provider === 'email' ? (
              <PrimaryButton secondary onPress={() => router.push('/app-password')}>
                設定 App 密碼
              </PrimaryButton>
            ) : null}
            <CloudBlockList />
            <AccountDeletionPanel />
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

export function PreferencesForm({
  initial,
  mode,
}: {
  initial: AccountPreferences;
  mode: 'settings' | 'recommendations';
}) {
  const actor = useAuthStore((state) => state.user?.id);
  const [notifications, setNotifications] = useState(initial.notifications);
  const [selected, setSelected] = useState(initial.preferred_tags);
  const [custom, setCustom] = useState('');
  const [saved, setSaved] = useState(false);
  const [pushChanged, setPushChanged] = useState(false);
  const [pushError, setPushError] = useState(false);
  const save = useMutation({
    mutationFn: () =>
      engagementApi.savePreferences(
        { notifications, preferred_tags: selected },
        queryClient.getQueryData<AccountPreferences>(['core', actor, 'preferences'])?.version ??
          initial.version,
      ),
    onSuccess: (value) => {
      if (useAuthStore.getState().user?.id !== actor) return;
      setSaved(true);
      if (mode === 'settings' && pushChanged) {
        void sendPushConfirmation()
          .then(() => {
            setPushChanged(false);
            setPushError(false);
          })
          .catch(() => setPushError(true));
      }
      queryClient.setQueryData(['core', actor, 'preferences'], value);
      void queryClient.invalidateQueries({ queryKey: ['core', actor, 'chat-activity'] });
    },
  });
  const toggle = (tag: string) => {
    setSaved(false);
    setSelected((old) =>
      old.includes(tag)
        ? old.filter((item) => item !== tag)
        : old.length < 24
          ? [...old, tag]
          : old,
    );
  };
  return (
    <View style={styles.card}>
      {mode === 'settings' ? (
        <>
          {options.map(([key, label, detail]) => (
            <View key={key} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.body}>{label}</Text>
                <Text style={styles.hint}>{detail}</Text>
              </View>
              <Switch
                accessibilityLabel={label}
                value={notifications[key]}
                disabled={save.isPending}
                onValueChange={(value) => {
                  setSaved(false);
                  setNotifications((old) => ({
                    ...old,
                    [key]: value,
                    ...(key === 'recommendations' ? { deadlineReminders: value } : {}),
                  }));
                }}
              />
            </View>
          ))}
          <WebPushSettings
            onEnabledChange={(enabled) => {
              setPushChanged(enabled);
              setSaved(false);
            }}
          />
        </>
      ) : (
        <>
          <Text style={styles.title}>想拼的東西</Text>
          <Text style={styles.hint}>選擇感興趣的項目，或新增自己的標籤。</Text>
          <View style={styles.wrap}>
            {[
              ...new Set([
                ...tags.slice(0, 7),
                ...selected.filter((tag) => !tags.slice(7).includes(tag)),
              ]),
            ].map((tag) => (
              <Pressable
                key={tag}
                accessibilityRole="checkbox"
                accessibilityLabel={tag}
                accessibilityState={{ checked: selected.includes(tag), disabled: save.isPending }}
                disabled={save.isPending}
                onPress={() => toggle(tag)}
                style={[
                  styles.choice,
                  selected.includes(tag) && {
                    ...yellowSurface,
                    backgroundColor: colors.yellowSoft,
                  },
                ]}
              >
                <Text style={styles.body}>
                  {selected.includes(tag) ? '✓ ' : ''}
                  {tag}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.title}>地點</Text>
          <View style={styles.wrap}>
            {tags.slice(7).map((tag) => (
              <Pressable
                key={tag}
                accessibilityRole="checkbox"
                accessibilityLabel={tag}
                accessibilityState={{ checked: selected.includes(tag) }}
                onPress={() => toggle(tag)}
                style={[
                  styles.choice,
                  selected.includes(tag) && {
                    ...yellowSurface,
                    backgroundColor: colors.yellowSoft,
                  },
                ]}
              >
                <Text style={styles.body}>
                  {selected.includes(tag) ? '✓ ' : ''}
                  {tag}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            accessibilityLabel="自訂推薦標籤"
            value={custom}
            onChangeText={setCustom}
            maxLength={32}
            editable={!save.isPending}
            style={styles.input}
          />
          <PrimaryButton
            secondary
            disabled={!custom.trim() || selected.length >= 24 || save.isPending}
            onPress={() => {
              if (!selected.includes(custom.trim())) setSelected((old) => [...old, custom.trim()]);
              setCustom('');
            }}
          >
            加入自訂標籤
          </PrimaryButton>
        </>
      )}
      <PrimaryButton
        disabled={save.isPending}
        onPress={() => save.mutate()}
        loading={save.isPending}
      >
        {save.isPending ? '儲存中' : '儲存'}
      </PrimaryButton>
      {saved ? (
        <Text accessibilityRole="alert" style={{ color: colors.success }}>
          ✓ 已儲存
        </Text>
      ) : null}
      {pushError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          設定已儲存，但通知未送出，請確認手機通知權限。
        </Text>
      ) : null}
      {save.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {coreError(save.error)} 未儲存內容仍保留。
        </Text>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 70 },
  card: { gap: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choice: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  title: { color: colors.ink, fontSize: 18, fontWeight: '700' },
  body: { color: colors.ink, fontSize: 15 },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 21 },
  error: { color: colors.danger },
  input: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
});
