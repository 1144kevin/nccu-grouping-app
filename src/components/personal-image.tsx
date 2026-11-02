import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { AppText as Text } from './app-text';
import { PageLoading } from './page-loading';
import { profileSocial } from '@/lib/profile-social';
import { useAuthStore } from '@/store/auth-store';
import { colors } from '@/theme/tokens';

export function PersonalImage({ id }: { id: string }) {
  const actor = useAuthStore((state) => state.user?.id);
  const query = useQuery({
    queryKey: ['core', actor, 'personal-image', id],
    queryFn: () => profileSocial.image(id),
    enabled: !!actor,
    staleTime: 60_000,
    gcTime: 0,
    retry: false,
  });
  if (query.isPending) return <PageLoading />;
  if (!query.data || query.error)
    return <Text style={{ color: colors.muted }}>佐證圖片暫時無法載入</Text>;
  return (
    <Image
      accessibilityLabel="檢舉佐證圖片"
      source={{ uri: `data:image/jpeg;base64,${query.data.content_base64}` }}
      contentFit="contain"
      style={{ width: '100%', height: 220, borderRadius: 12 }}
    />
  );
}
