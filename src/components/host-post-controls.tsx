import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { View } from 'react-native';
import { AppText as Text } from '@/components/app-text';
import { PrimaryButton } from '@/components/primitives';
import { coreApi, coreError, type CorePost } from '@/lib/core-api';
import { invalidateCore } from '@/lib/core-hooks';
import { colors } from '@/theme/tokens';

export function HostPostControls({ post }: { post: CorePost }) {
  const [confirm, setConfirm] = useState(false);
  const cancel = useMutation({
    mutationFn: () => coreApi.cancel(post.id),
    onSettled: invalidateCore,
  });
  if (post.my_status !== 'host') return null;
  const closed = post.status === 'expired' || post.status === 'cancelled';
  return (
    <View style={{ gap: 12 }}>
      {post.can_edit && !closed ? (
        <PrimaryButton secondary onPress={() => router.push(`/edit-post/${post.id}`)}>
          編輯拼單
        </PrimaryButton>
      ) : null}
      {!closed && !confirm ? (
        <PrimaryButton secondary onPress={() => setConfirm(true)}>
          取消拼單
        </PrimaryButton>
      ) : null}
      {!closed && confirm ? (
        <View style={{ gap: 12 }}>
          <Text>確定取消整筆拼單？取消後不能再加入或接受申請。</Text>
          <PrimaryButton disabled={cancel.isPending} onPress={() => cancel.mutate()}>
            {cancel.isPending ? '取消中…' : '確認取消拼單'}
          </PrimaryButton>
          <PrimaryButton secondary disabled={cancel.isPending} onPress={() => setConfirm(false)}>
            繼續保留
          </PrimaryButton>
        </View>
      ) : null}
      {cancel.error ? (
        <Text accessibilityRole="alert" style={{ color: colors.danger }}>
          {coreError(cancel.error)}
        </Text>
      ) : null}
    </View>
  );
}
