import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Switch, View } from 'react-native';
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
import { DraftImageManager } from '@/components/core-post-image';
import { AccountDeletionPanel } from '@/components/core-account-deletion';
import { CloudBlockList } from '@/components/core-user-blocks';
import { CoreConnectionStatus } from '@/components/core-connection-status';
import { colors, radius, spacing } from '@/theme/tokens';

const options: [keyof NotificationPreferences, string, string][] = [
  ['joinRequests', '拼單申請提示', '控制 App 內待審核提示，不會隱藏申請紀錄'],
  ['messages', '聊天未讀提示', '控制 App 內聊天未讀徽章'],
  ['recommendations', '推薦提示', '儲存偏好；目前尚未發送手機推薦推播'],
  ['deadlineReminders', '截止提醒偏好', '儲存偏好；尚未啟用背景提醒送達'],
  ['stealthInvites', '偷揪邀請提示', '儲存提示偏好，不會代替分身的啟用設定'],
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
  const logout = useAuthStore((state) => state.logout);
  const query = useAccountPreferences();
  return (
    <Screen>
      <DetailHeader title={mode === 'settings' ? '帳號與隱私' : '推薦偏好'} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        {mode === 'settings' && user ? (
          <>
            <View style={styles.row}>
              <Avatar name={user.display_name} badge={user.badge ?? '🍱'} size={48} />
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
        <Text style={styles.hint}>
          設定會儲存至你的 Supabase 帳號。這些開關不會要求手機通知權限；目前沒有遠端推播。
        </Text>
        {query.data ? (
          <Text accessibilityLiveRegion="polite" style={styles.hint}>
            目前已儲存版本：{query.data.version}。修改後請按儲存。
          </Text>
        ) : null}
        {query.isPending ? (
          <ActivityIndicator />
        ) : query.data ? (
          <PreferencesForm
            key={`${user?.id}:${query.data.version}:${mode}`}
            initial={query.data}
            mode={mode}
          />
        ) : null}
        {query.error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {coreError(query.error)}
          </Text>
        ) : null}
        <PrimaryButton
          secondary
          onPress={() => {
            void query.refetch();
          }}
        >
          重新載入已儲存設定（捨棄未儲存內容）
        </PrimaryButton>
        {mode === 'settings' ? (
          <>
            <DraftImageManager />
            <PrimaryButton secondary onPress={() => router.push('/app-password')}>
              設定 App 密碼（Expo Go 登入）
            </PrimaryButton>
            <CoreConnectionStatus />
            <CloudBlockList />
            <AccountDeletionPanel />
            <PrimaryButton secondary onPress={() => router.push('/preferences')}>
              調整推薦偏好
            </PrimaryButton>
            <PrimaryButton secondary onPress={() => router.push('/help')}>
              我的回報與協助
            </PrimaryButton>
            <PrimaryButton
              secondary
              onPress={() => {
                void logout();
              }}
            >
              登出帳號
            </PrimaryButton>
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
  const save = useMutation({
    mutationFn: () =>
      engagementApi.savePreferences({ notifications, preferred_tags: selected }, initial.version),
    onSuccess: (value) => {
      if (useAuthStore.getState().user?.id !== actor) return;
      queryClient.setQueryData(['core', actor, 'preferences'], value);
      void queryClient.invalidateQueries({ queryKey: ['core', actor, 'chat-activity'] });
    },
  });
  const toggle = (tag: string) =>
    setSelected((old) =>
      old.includes(tag)
        ? old.filter((item) => item !== tag)
        : old.length < 24
          ? [...old, tag]
          : old,
    );
  return (
    <View style={styles.card}>
      {mode === 'settings' ? (
        options.map(([key, label, detail]) => (
          <View key={key} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.body}>{label}</Text>
              <Text style={styles.hint}>{detail}</Text>
            </View>
            <Switch
              accessibilityLabel={label}
              value={notifications[key]}
              disabled={save.isPending}
              onValueChange={(value) => setNotifications((old) => ({ ...old, [key]: value }))}
            />
          </View>
        ))
      ) : (
        <>
          <Text style={styles.title}>我感興趣的餐點與地點</Text>
          <Text style={styles.hint}>
            推薦排序會優先顯示符合標籤的進行中拼單；最新拼單與搜尋仍可查看其他內容。
          </Text>
          <View style={styles.wrap}>
            {[...new Set([...tags, ...selected])].map((tag) => (
              <Pressable
                key={tag}
                accessibilityRole="checkbox"
                accessibilityLabel={tag}
                accessibilityState={{ checked: selected.includes(tag), disabled: save.isPending }}
                disabled={save.isPending}
                onPress={() => toggle(tag)}
                style={[
                  styles.choice,
                  selected.includes(tag) && { backgroundColor: colors.yellowSoft },
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
      <PrimaryButton disabled={save.isPending} onPress={() => save.mutate()}>
        {save.isPending ? '儲存中…' : '儲存帳號偏好'}
      </PrimaryButton>
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
