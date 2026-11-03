import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { View } from 'react-native';
import { AppText as Text } from './app-text';
import { PrimaryButton } from './primitives';
import { userBlocksApi, useBlockedUsers } from '@/lib/user-blocks-api';
import { coreError } from '@/lib/core-api';
import { queryClient } from '@/lib/query-client';
import { useAuthStore } from '@/store/auth-store';
export function CloudBlockButton({ id, name }: { id: string; name?: string }) {
  const actor = useAuthStore((s) => s.user?.id);
  const blocked = useBlockedUsers();
  const [confirm, setConfirm] = useState(false);
  const mine = blocked.data?.items.some((item) => item.user_id === id) ?? false;
  const mutation = useMutation({
    mutationFn: () => (mine ? userBlocksApi.unblock(id) : userBlocksApi.block(id)),
    onSuccess: async () => {
      if (useAuthStore.getState().user?.id !== actor) return;
      setConfirm(false);
      // Drop previously visible content immediately, rather than retaining it on a 404 refetch.
      await queryClient.resetQueries({ queryKey: ['core', actor] });
    },
  });
  if (!actor || actor === id) return null;
  return (
    <View style={{ gap: 8 }}>
      <Text>
        {mine
          ? '你已封鎖這位使用者。'
          : '封鎖會隱藏對方公開內容，取消雙方待審申請，並停止新的互動與配對。既有團員不會自動退出；同群有封鎖關係時，雙方不能發送新訊息。'}
      </Text>
      {confirm ? (
        <>
          <Text>
            {mine
              ? '解除後可重新互動，舊申請與配對不會恢復。'
              : `確認封鎖${name ? `「${name}」` : '這位使用者'}？`}
          </Text>
          <PrimaryButton
            disabled={mutation.isPending || !blocked.data}
            loading={mutation.isPending}
            onPress={() => mutation.mutate()}
          >
            {mine ? '確認解除封鎖' : '確認封鎖使用者'}
          </PrimaryButton>
          <PrimaryButton secondary disabled={mutation.isPending} onPress={() => setConfirm(false)}>
            取消
          </PrimaryButton>
        </>
      ) : (
        <PrimaryButton
          secondary
          disabled={!blocked.data || mutation.isPending}
          onPress={() => setConfirm(true)}
        >
          {mine ? '解除封鎖' : '封鎖使用者'}
        </PrimaryButton>
      )}
      {blocked.error || mutation.error ? (
        <Text accessibilityRole="alert">{coreError(blocked.error || mutation.error)}</Text>
      ) : null}
    </View>
  );
}

export function CloudBlockList() {
  const query = useBlockedUsers();
  return (
    <View style={{ gap: 12 }}>
      <Text style={{ fontWeight: '700' }}>封鎖名單</Text>
      {query.data?.items.length === 0 ? <Text>目前沒有封鎖使用者。</Text> : null}
      {query.data?.items.map((item) => (
        <View key={item.user_id} style={{ gap: 6 }}>
          <Text>{item.display_name}</Text>
          <CloudBlockButton id={item.user_id} name={item.display_name} />
        </View>
      ))}
      {query.error ? <Text accessibilityRole="alert">{coreError(query.error)}</Text> : null}
      <PrimaryButton
        secondary
        disabled={query.isFetching}
        onPress={() => {
          void query.refetch();
        }}
      >
        重新載入封鎖名單
      </PrimaryButton>
    </View>
  );
}
