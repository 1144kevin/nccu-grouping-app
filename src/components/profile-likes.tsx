import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppText as Text } from './app-text';
import { useAuthStore } from '@/store/auth-store';
import { profileSocial } from '@/lib/profile-social';
import { colors } from '@/theme/tokens';
import { coreError } from '@/lib/core-api';

export function ProfileLikes({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const actor = useAuthStore((state) => state.user?.id);
  const key = ['core', actor, 'profile-likes', id];
  const query = useQuery({
    queryKey: key,
    queryFn: () => profileSocial.likes(id),
    enabled: !!actor,
    retry: false,
  });
  const change = useMutation({
    mutationFn: () => profileSocial.like(id, !query.data?.liked),
    onSuccess: (data) => {
      if (useAuthStore.getState().user?.id !== actor) return;
      queryClient.setQueryData(key, data);
      void queryClient.invalidateQueries({ queryKey: ['core', actor, 'public-user', id] });
      void queryClient.invalidateQueries({ queryKey: ['core', actor, 'experience'] });
    },
  });
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={actor === id ? '收到的讚' : query.data?.liked ? '收回讚' : '按讚'}
        accessibilityState={{
          selected: query.data?.liked,
          disabled: !query.data || actor === id || change.isPending,
        }}
        disabled={!query.data || actor === id || change.isPending}
        onPress={() => change.mutate()}
        style={{
          flexDirection: 'row',
          gap: 7,
          alignItems: 'center',
          paddingVertical: 10,
          alignSelf: 'flex-start',
          minHeight: 44,
        }}
      >
        {change.isPending ? (
          <ActivityIndicator size="small" color={colors.muted} />
        ) : (
          <MaterialCommunityIcons
            name={query.data?.liked ? 'heart' : 'heart-outline'}
            size={22}
            color={query.data?.liked ? colors.danger : colors.muted}
          />
        )}
        <Text style={{ color: colors.ink, fontSize: 14 }}>{query.data?.likes ?? '—'} 個讚</Text>
      </Pressable>
      {change.error || query.error ? (
        <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12 }}>
          {coreError(change.error ?? query.error)}
        </Text>
      ) : null}
    </View>
  );
}
