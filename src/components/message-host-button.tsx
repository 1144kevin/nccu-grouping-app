import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { View } from 'react-native';
import { AppText as Text } from '@/components/app-text';
import { PrimaryButton } from '@/components/primitives';
import { coreError, type CorePost } from '@/lib/core-api';
import { socialApi } from '@/lib/social-api';
import { useAuthStore } from '@/store/auth-store';
import { colors } from '@/theme/tokens';

export function MessageHostButton({ post }: { post: CorePost }) {
  const actor = useAuthStore((s) => s.user?.id);
  const start = useMutation({
    mutationFn: () => socialApi.start(post.id),
    onSuccess: (thread) => {
      if (useAuthStore.getState().user?.id === actor) router.push(`/direct-chat/${thread.id}`);
    },
  });
  if (post.my_status === 'host' || post.is_demo) return null;
  return (
    <View>
      <PrimaryButton secondary disabled={start.isPending} onPress={() => start.mutate()}>
        {start.isPending ? '開啟中…' : '私訊主揪'}
      </PrimaryButton>
      {start.error ? (
        <Text accessibilityRole="alert" style={{ color: colors.danger }}>
          {coreError(start.error)}
        </Text>
      ) : null}
    </View>
  );
}
