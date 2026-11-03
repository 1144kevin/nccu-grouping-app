import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Modal, View } from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from './app-text';
import { PrimaryButton, Screen } from './primitives';
import { accountDeletionApi, type DeletionPreview } from '@/lib/account-deletion-api';
import { coreApi, coreError } from '@/lib/core-api';
import { useCoreScreenFocused } from '@/lib/core-hooks';
import { completeAccountDeletion, useAuthStore } from '@/store/auth-store';
import { colors } from '@/theme/tokens';
export function AccountDeletionPanel() {
  const focused = useCoreScreenFocused();
  return <AccountDeletionForm focused={focused} />;
}

function AccountDeletionForm({ focused }: { focused: boolean }) {
  const actor = useAuthStore((s) => s.user?.id);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<DeletionPreview | null>(null);
  const [text, setText] = useState('');
  const status = useQuery({
    queryKey: ['core', actor, 'deletion-status'],
    queryFn: accountDeletionApi.status,
    enabled: !!actor && focused,
    retry: false,
  });
  const prepare = useMutation({
    mutationFn: accountDeletionApi.preview,
    onSuccess: (value) => {
      if (useAuthStore.getState().user?.id === actor) {
        setPreview(value);
        setText('');
      }
    },
  });
  const remove = useMutation({
    mutationFn: async () => {
      if (!actor || text !== 'DELETE' || useAuthStore.getState().user?.id !== actor)
        throw new Error('explicit_account_deletion_required');
      useAuthStore.setState({ busy: true, error: null });
      try {
        await accountDeletionApi.delete(
          status.data?.phase === 'deleting' ? undefined : preview?.challenge,
        );
        await completeAccountDeletion(actor);
      } catch (error) {
        if (useAuthStore.getState().user?.id === actor) {
          try {
            const user = await coreApi.me();
            if (useAuthStore.getState().user?.id === actor)
              useAuthStore.setState({ user, error: coreError(error) });
          } catch {
            /* Preserve retry state on network errors. */
          }
        }
        throw error;
      } finally {
        if (!useAuthStore.getState().user || useAuthStore.getState().user?.id === actor)
          useAuthStore.setState({ busy: false });
      }
    },
  });
  const deleting = status.data?.phase === 'deleting';
  return (
    <View style={{ gap: 12, paddingVertical: 16 }}>
      <PrimaryButton
        secondary
        disabled={!status.data || prepare.isPending}
        onPress={() => {
          setOpen(true);
          if (status.data?.recent_auth && status.data.phase !== 'deleting') prepare.mutate();
        }}
      >
        刪除我的帳號
      </PrimaryButton>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#0009' }}>
          <View
            style={{ padding: 20, gap: 12, borderRadius: 18, backgroundColor: colors.background }}
          >
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.ink }}>刪除我的帳號</Text>
            <Text style={{ color: colors.ink }}>
              帳號、個人資料、主揪拼單及相關聊天室會永久刪除；你會退出其他拼單。此操作無法復原。
            </Text>
            {deleting ? (
              <Text accessibilityRole="alert">
                清除已開始但尚未完成，帳號暫停一般操作。請輸入 DELETE
                繼續清除；若登入已超過15分鐘，先登出再登入同一帳號。
              </Text>
            ) : null}
            {status.data && !status.data.recent_auth ? (
              <>
                <Text>刪除前需在15分鐘內重新登入；續期不算重新登入。</Text>
                <PrimaryButton
                  secondary
                  onPress={() => {
                    void useAuthStore.getState().logout();
                  }}
                >
                  登出後重新登入
                </PrimaryButton>
              </>
            ) : null}
            {preview || deleting ? (
              <>
                <Text>
                  {deleting
                    ? '請手動輸入大寫 DELETE，確認繼續清理。'
                    : '請手動輸入大寫 DELETE，再按最後確認。預覽確認碼10分鐘內有效。'}
                </Text>
                <TextInput
                  accessibilityLabel="輸入 DELETE 確認刪除帳號"
                  value={text}
                  onChangeText={setText}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  editable={!remove.isPending}
                  style={{ borderWidth: 1, padding: 12 }}
                />
                <PrimaryButton
                  disabled={text !== 'DELETE' || !status.data?.recent_auth || remove.isPending}
                  onPress={() => remove.mutate()}
                  loading={remove.isPending}
                >
                  {remove.isPending
                    ? '正在清除，請勿關閉'
                    : deleting
                      ? '繼續刪除我的帳號'
                      : '永久刪除我的 App 帳號'}
                </PrimaryButton>
                {!deleting ? (
                  <PrimaryButton
                    secondary
                    disabled={remove.isPending}
                    onPress={() => {
                      setPreview(null);
                      setText('');
                    }}
                  >
                    取消，保留帳號
                  </PrimaryButton>
                ) : null}
              </>
            ) : null}
            {status.error || prepare.error || remove.error ? (
              <Text accessibilityRole="alert">
                {coreError(status.error || prepare.error || remove.error)}
              </Text>
            ) : null}
            <PrimaryButton secondary disabled={remove.isPending} onPress={() => setOpen(false)}>
              關閉
            </PrimaryButton>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export function AccountDeletionRecovery() {
  return (
    <Screen scroll>
      <View style={{ padding: 20 }}>
        <AccountDeletionForm focused />
      </View>
    </Screen>
  );
}
