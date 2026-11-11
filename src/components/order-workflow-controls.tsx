import { useMutation, useQuery } from '@tanstack/react-query';
import { View } from 'react-native';
import { AppText as Text } from '@/components/app-text';
import { PrimaryButton } from '@/components/primitives';
import { captureOrderPhoto } from '@/lib/capture-order-photo';
import { coreError, newRequestKey } from '@/lib/core-api';
import { invalidateCore } from '@/lib/core-hooks';
import { profileSocial } from '@/lib/profile-social';
import { queryClient } from '@/lib/query-client';
import { socialApi, type OrderWorkflow } from '@/lib/social-api';
import { useAuthStore } from '@/store/auth-store';
import { colors } from '@/theme/tokens';

const stageText: Record<OrderWorkflow['stage'], string> = {
  waiting: '待成團',
  formed: '已成團',
  en_route: '前往中',
  delivering: '交貨中',
  completed: '已完成',
};
export function OrderWorkflowControls({
  id,
  actor,
  active,
}: {
  id: string;
  actor: string;
  active: boolean;
}) {
  const key = ['core', actor, 'order-workflow', id];
  const query = useQuery({
    queryKey: key,
    queryFn: () => socialApi.workflow(id),
    enabled: active,
    refetchInterval: active ? 5000 : false,
    retry: false,
  });
  const action = useMutation({
    mutationFn: async (kind: 'vote' | 'depart' | 'purchase' | 'complete') => {
      let image: string | undefined;
      if (kind === 'purchase' || (kind === 'complete' && !query.data?.is_host)) {
        const photo = await captureOrderPhoto();
        if (!photo) return null;
        if (!photo.base64) throw new Error('invalid_image_input');
        image = (await profileSocial.upload('evidence', photo.base64, newRequestKey())).id;
      }
      return socialApi.workflowAction(id, kind, image);
    },
    onSuccess: (value) => {
      if (!value || useAuthStore.getState().user?.id !== actor) return;
      queryClient.setQueryData(key, value);
      void invalidateCore();
    },
  });
  if (!active) return null;
  if (!query.data)
    return query.error ? (
      <Text accessibilityRole="alert" style={{ color: colors.danger }}>
        {coreError(query.error)}
      </Text>
    ) : null;
  const state = query.data;
  const button =
    state.stage === 'waiting' && state.member_count > 1 && (state.is_host || state.host_vote)
      ? {
          action: 'vote' as const,
          text: state.my_vote ? '已同意成團' : '成團',
          disabled: state.my_vote,
        }
      : state.stage === 'formed' && state.is_host
        ? { action: 'depart' as const, text: '出發', disabled: false }
        : state.stage === 'en_route' && state.is_host
          ? { action: 'purchase' as const, text: '購買完成', disabled: false }
          : state.stage === 'delivering'
            ? {
                action: 'complete' as const,
                text: state.my_completed ? '已確認完成訂單' : '完成訂單',
                disabled: state.my_completed,
              }
            : null;
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontWeight: '700', color: colors.ink }}>{stageText[state.stage]}</Text>
      {state.stage === 'waiting' && state.host_vote ? (
        <Text>
          成團確認 {state.formation_votes}/{state.member_count}
        </Text>
      ) : null}
      {state.stage === 'delivering' ? (
        <Text>
          完成確認 {state.completed_count}/{state.member_count}
        </Text>
      ) : null}
      {button ? (
        <PrimaryButton
          loading={action.isPending}
          disabled={button.disabled || action.isPending}
          onPress={() => action.mutate(button.action)}
        >
          {button.text}
        </PrimaryButton>
      ) : null}
      {action.error ? (
        <Text accessibilityRole="alert" style={{ color: colors.danger }}>
          {coreError(action.error)}
        </Text>
      ) : null}
    </View>
  );
}
