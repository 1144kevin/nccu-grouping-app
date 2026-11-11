import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';
import { AppText as Text } from '@/components/app-text';
import { PrimaryButton } from '@/components/primitives';
import { coreApi, coreError, type CorePost } from '@/lib/core-api';
import { invalidateCore } from '@/lib/core-hooks';
import { usePostCacheSync } from '@/lib/core-post-cache';
import { colors } from '@/theme/tokens';

export function CorePostActions({
  post: suppliedPost,
  onManage,
}: {
  post: CorePost;
  onManage?: () => void;
}) {
  const sync = usePostCacheSync();
  const [confirmed, setConfirmed] = useState<{ source: CorePost; post: CorePost } | null>(null);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  // A card can be rendered from a fixed search/detail/list snapshot. Its own
  // successful action must still update the button before that parent refreshes.
  // A new parent snapshot takes precedence, including a later host acceptance.
  const post = confirmed?.source === suppliedPost ? confirmed.post : suppliedPost;
  const withdrawing = post.my_status === 'pending' || post.my_status === 'accepted';
  const closed =
    !!post.completed || (post.status === 'expired' && !withdrawing) || post.status === 'cancelled';
  const mutation = useMutation({
    mutationFn: async () => {
      if (withdrawing) {
        return coreApi.withdraw(post.id);
      } else {
        const request = await coreApi.requestJoin(post.id, post.version ?? 1);
        return { ...post, my_status: request.status };
      }
    },
    onSuccess: (updated) => {
      if (sync.update(updated)) setConfirmed({ source: suppliedPost, post: updated });
    },
    onError: () => {
      void sync.refresh(post.id);
    },
    onSettled: () => {
      void invalidateCore();
    },
  });
  const label =
    post.my_status === 'host'
      ? '管理拼單'
      : post.completed
        ? '已完成'
        : post.status === 'cancelled'
          ? '已取消'
          : post.status === 'expired' && !withdrawing
            ? '已截止'
            : post.my_status === 'pending'
              ? '取消申請'
              : post.my_status === 'accepted'
                ? '退出並釋出名額'
                : post.status === 'full'
                  ? '已額滿'
                  : '想被揪';
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <PrimaryButton
        disabled={
          post.my_status !== 'host' &&
          (mutation.isPending || closed || (post.status === 'full' && !withdrawing))
        }
        onPress={() =>
          post.my_status === 'host'
            ? onManage
              ? onManage()
              : router.push(`/order/${post.id}`)
            : post.my_status === 'accepted'
              ? setConfirmWithdraw(true)
              : mutation.mutate()
        }
        loading={mutation.isPending}
      >
        {mutation.isPending ? '處理中' : label}
      </PrimaryButton>
      {confirmWithdraw && post.my_status === 'accepted' ? (
        <View style={{ gap: 8 }}>
          <Text>
            退出拼單將扣除{' '}
            {post.workflow_stage === 'delivering' ? 10 : post.workflow_stage === 'en_route' ? 5 : 1}{' '}
            分信譽積分，實際扣分以送出當下的狀態為準。
          </Text>
          <PrimaryButton
            disabled={mutation.isPending}
            onPress={() => {
              setConfirmWithdraw(false);
              mutation.mutate();
            }}
          >
            確認退出拼單
          </PrimaryButton>
          <PrimaryButton secondary onPress={() => setConfirmWithdraw(false)}>
            保留拼單
          </PrimaryButton>
        </View>
      ) : null}
      {mutation.error ? (
        <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 13 }}>
          {coreError(mutation.error)}
        </Text>
      ) : null}
    </View>
  );
}
