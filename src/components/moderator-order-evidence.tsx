import { useQuery } from '@tanstack/react-query';
import { View } from 'react-native';
import { AppText as Text } from '@/components/app-text';
import { PersonalImage } from '@/components/personal-image';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';

export function ModeratorOrderEvidence({ postId }: { postId: string }) {
  const actor = useAuthStore((s) => s.user?.id);
  const query = useQuery({
    queryKey: ['core', actor, 'order-evidence', postId],
    queryFn: async () =>
      (
        await api.get<{ items: { id: string; image_id: string; kind: 'purchase' | 'pickup' }[] }>(
          `/moderation/orders/${encodeURIComponent(postId)}/evidence`,
        )
      ).data,
    enabled: !!actor,
    retry: false,
  });
  if (!query.data?.items.length) return null;
  return (
    <View style={{ gap: 8 }}>
      <Text>拼單購買與取貨佐證（僅管理員）</Text>
      {query.data.items.map((item) => (
        <View key={item.id} style={{ gap: 4 }}>
          <Text>{item.kind === 'purchase' ? '購買佐證' : '取貨佐證'}</Text>
          <PersonalImage id={item.image_id} />
        </View>
      ))}
    </View>
  );
}
