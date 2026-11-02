import { View } from 'react-native';
import { Avatar } from './primitives';
import { CorePostImage } from './core-post-image';
import { AppText as Text } from './app-text';
import { useAuthStore } from '@/store/auth-store';
import type { CorePost } from '@/lib/core-api';
import { colors } from '@/theme/tokens';

export function PostThumbnail({ post, size = 56 }: { post: CorePost; size?: number }) {
  const actor = useAuthStore((s) => s.user?.id);
  const image = post.images?.[0]?.id ?? post.image_id;
  const avatar = (
    <Avatar
      name={post.author_name}
      badge={post.author_badge ?? '🍱'}
      userId={post.author_id}
      square
      size={size}
    />
  );
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 0,
        overflow: 'hidden',
        backgroundColor: colors.surface,
      }}
    >
      {image ? (
        <CorePostImage imageId={image} frameHeight={size} fit="cover" fallback={avatar} />
      ) : (
        avatar
      )}
      {actor && actor === post.author_id ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 8,
            left: -22,
            width: 78,
            height: 18,
            backgroundColor: colors.yellow,
            transform: [{ rotate: '-45deg' }],
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text fixedSize style={{ fontSize: 10, fontWeight: '700', color: colors.onYellow }}>
            主揪
          </Text>
        </View>
      ) : null}
    </View>
  );
}
