import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { View } from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from './app-text';
import { PrimaryButton, Screen } from './primitives';
import { accountDeletionApi, type DeletionPreview } from '@/lib/account-deletion-api';
import { coreApi, coreError } from '@/lib/core-api';
import { useCoreScreenFocused } from '@/lib/core-hooks';
import { completeAccountDeletion, useAuthStore } from '@/store/auth-store';
export function AccountDeletionPanel() {
  const focused = useCoreScreenFocused();
  return <AccountDeletionForm focused={focused} />;
}

function AccountDeletionForm({ focused }: { focused: boolean }) {
  const actor = useAuthStore((s) => s.user?.id);
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
  const counts = preview?.counts ?? status.data?.counts;
  return (
    <View style={{ gap: 12, paddingVertical: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: '700' }}>刪除我的帳號</Text>
      <Text>
        這會刪除 App
        帳號、個人資料、分身、需求、偏好、圖片與自己發送的訊息。你主揪的拼單、相關聊天室及自己建立的示範批次會移除，其他團員也會失去這些紀錄。你參與別人的拼單會退出並釋出名額；其他人的拼單與訊息保留。
      </Text>
      <Text>
        這不是登出，完成後無法在 App 復原；不會刪除你的 Google
        帳號或手機原始照片。已被他人保存的副本、他人文字中的引用與備份不保證即時抹除。再次 Google
        登入會建立新的 App 帳號。
      </Text>
      {counts ? (
        <Text>
          目前影響：{counts.owned_posts} 筆主揪／示範拼單、{counts.messages} 則本人訊息、
          {counts.images} 份圖片、{counts.participations} 筆參與紀錄、{counts.proposals}{' '}
          組偷揪結果。數量以真正執行時為準。
        </Text>
      ) : null}
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
      {!deleting ? (
        <PrimaryButton
          secondary
          disabled={!status.data?.recent_auth || prepare.isPending || remove.isPending}
          onPress={() => prepare.mutate()}
        >
          先查看刪除影響並取得確認
        </PrimaryButton>
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
      <PrimaryButton
        secondary
        disabled={status.isFetching || remove.isPending}
        onPress={() => {
          void status.refetch();
        }}
      >
        重新查看清理狀態
      </PrimaryButton>
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
