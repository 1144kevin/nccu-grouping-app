import { View } from 'react-native';
import { Avatar } from './primitives';
import { CorePostImage } from './core-post-image';
import { useAuthStore } from '@/store/auth-store';
import type { InboxThread } from '@/lib/social-api';
import { colors } from '@/theme/tokens';

export function InboxAvatar({ item }: { item: InboxThread }) {
  const actor = useAuthStore((s) => s.user?.id);
  if (item.kind === 'direct')
    return <Avatar name={item.peer_name} badge={item.peer_badge} userId={item.peer_id} size={56} />;
  if (item.kind === 'stealth') {
    const members = (item.avatar_members ?? []).filter((m) => m.id !== actor).slice(0, 2);
    const circles = members.length
      ? members
      : [{ id: '', name: '偷揪夥伴', badge: item.peer_badge }];
    if (circles.length === 1)
      return (
        <Avatar
          name={circles[0].name}
          badge={circles[0].badge}
          userId={circles[0].id || undefined}
          size={56}
        />
      );
    return (
      <View accessibilityLabel="偷揪夥伴頭像" style={{ width: 56, height: 56 }}>
        {circles.map((member, index) => (
          <View
            key={member.id || index}
            style={{
              position: 'absolute',
              top: index === 0 ? 0 : 16,
              left: index === 0 ? 16 : 0,
              borderWidth: 2,
              borderColor: colors.background,
              borderRadius: 22,
              overflow: 'hidden',
              zIndex: index,
            }}
          >
            <Avatar
              name={member.name}
              badge={member.badge}
              userId={member.id || undefined}
              size={36}
            />
          </View>
        ))}
      </View>
    );
  }
  const fallback = (
    <Avatar
      name={item.post.author_name}
      badge={item.post.author_badge ?? item.peer_badge}
      userId={item.post.author_id}
      size={56}
    />
  );
  const image = item.post.images?.[0]?.id ?? item.post.image_id;
  return (
    <View style={{ width: 56, height: 56, borderRadius: 28, overflow: 'hidden' }}>
      {image ? (
        <CorePostImage imageId={image} frameHeight={56} fit="cover" fallback={fallback} />
      ) : (
        fallback
      )}
    </View>
  );
}
