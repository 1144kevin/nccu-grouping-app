import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { View } from 'react-native';
import { AppText as Text } from '@/components/app-text';
import { PrimaryButton } from '@/components/primitives';
import { coreApi, coreError, type CorePost } from '@/lib/core-api';
import { invalidateCore } from '@/lib/core-hooks';
import { colors } from '@/theme/tokens';

export function CorePostActions({ post, onManage }: { post: CorePost; onManage?: () => void }) {
  const withdrawing = post.my_status === 'pending' || post.my_status === 'accepted';
  const closed = post.status === 'expired' || post.status === 'cancelled';
  const mutation = useMutation({
    mutationFn: async () => {
      if (withdrawing) await coreApi.withdraw(post.id);
      else await coreApi.requestJoin(post.id, post.version ?? 1);
    },
    onSettled: invalidateCore,
  });
  const label =
    post.my_status === 'host'
      ? '管理拼單'
      : post.status === 'cancelled'
        ? '已取消'
        : post.status === 'expired'
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
            : mutation.mutate()
        }
        loading={mutation.isPending}
      >
        {mutation.isPending ? '處理中' : label}
      </PrimaryButton>
      {mutation.error ? (
        <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 13 }}>
          {coreError(mutation.error)}
        </Text>
      ) : null}
    </View>
  );
}
