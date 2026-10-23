import type { ComponentProps } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/app-text';
import { Avatar, Pill } from '@/components/primitives';
import { CorePostImage } from '@/components/core-post-image';
import type { CorePost } from '@/lib/core-api';
import { formatPrice } from '@/lib/price';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export const postStatusLabels = {
  open: '進行中',
  full: '已額滿',
  expired: '已截止',
  cancelled: '已取消',
};

export function shortDate(value: string) {
  return new Date(value).toLocaleString('zh-TW', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function SegmentedTabs<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; count?: number }[];
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.tabs}>
      {options.map((item) => (
        <Pressable
          key={item.value}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === item.value }}
          onPress={() => onChange(item.value)}
          style={[styles.tab, value === item.value && styles.activeTab]}
        >
          <Text style={[styles.tabText, value === item.value && styles.activeTabText]}>
            {item.label}
          </Text>
          {!!item.count && (
            <View style={styles.count}>
              <Text style={styles.countText}>{item.count > 99 ? '99+' : item.count}</Text>
            </View>
          )}
        </Pressable>
      ))}
    </View>
  );
}

export function ListMeta({
  icon,
  children,
}: {
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  children: string;
}) {
  return (
    <View style={styles.meta}>
      <MaterialCommunityIcons name={icon} size={14} color={colors.muted} />
      <Text numberOfLines={1} style={styles.metaText}>
        {children}
      </Text>
    </View>
  );
}

export function CorePostRow({
  post,
  order = false,
  notice,
}: {
  post: CorePost;
  order?: boolean;
  notice?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`查看${order ? '拼單' : '貼文'} ${post.content}`}
      onPress={() => router.push(order ? `/order/${post.id}` : `/post/${post.id}`)}
      style={({ pressed }) => [
        styles.postRow,
        !!notice && styles.attention,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.author}>
        <Avatar name={post.author_name} badge={post.author_badge ?? '🍱'} size={44} />
        <View style={styles.identity}>
          <Text numberOfLines={1} style={styles.name}>
            {post.author_name}
          </Text>
          <Text style={styles.metaText}>
            {post.my_status === 'host'
              ? '我主揪的'
              : post.my_status === 'pending'
                ? '等待接受'
                : post.my_status === 'accepted'
                  ? '已加入'
                  : '主揪'}
          </Text>
        </View>
        <Pill
          tone={post.status === 'open' ? 'yellow' : post.status === 'full' ? 'success' : 'plain'}
        >
          {postStatusLabels[post.status]}
        </Pill>
        <MaterialCommunityIcons name="chevron-right" size={18} color={colors.subtle} />
      </View>
      <Text numberOfLines={2} style={styles.preview}>
        {post.content}
      </Text>
      {post.image_id ? (
        <View style={styles.image}>
          <CorePostImage imageId={post.image_id} compact />
        </View>
      ) : null}
      <View style={styles.metadata}>
        <ListMeta icon="map-marker-outline">{post.location?.name ?? '地點待確認'}</ListMeta>
        <ListMeta icon="account-group-outline">{`${post.joined}/${post.capacity} 人`}</ListMeta>
        <ListMeta icon="cash">
          {formatPrice(post.price_per_person == null ? undefined : Number(post.price_per_person))}
        </ListMeta>
      </View>
      <View style={styles.metadata}>
        <ListMeta icon="clock-outline">{`${shortDate(post.deadline_at)} 截止`}</ListMeta>
        {post.tags.length ? (
          <Text numberOfLines={1} style={styles.tags}>
            {post.tags
              .slice(0, 3)
              .map((t) => `#${t}`)
              .join(' ')}
          </Text>
        ) : null}
      </View>
      {post.semantic_recommendation ? <Text style={styles.tags}>符合你的需求</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {post.is_demo ? <Text style={styles.metaText}>示範資料</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabs: {
    minHeight: 48,
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 4,
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  activeTab: { borderBottomColor: colors.yellow },
  tabText: { color: colors.muted, fontFamily: typography.regular, fontSize: 14 },
  activeTabText: { color: colors.ink, fontWeight: '700' },
  count: {
    minWidth: 18,
    paddingHorizontal: 4,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { fontSize: 11, color: '#fff', fontWeight: '700' },
  postRow: {
    paddingVertical: 16,
    paddingHorizontal: spacing.lg,
    gap: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  attention: { backgroundColor: '#FFF9DF' },
  author: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  identity: { flex: 1, minWidth: 0, gap: 3 },
  name: { color: colors.ink, fontSize: 15, fontFamily: typography.rounded, fontWeight: '700' },
  preview: { color: colors.ink, fontSize: 15, lineHeight: 22, fontFamily: typography.regular },
  metadata: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%' },
  metaText: { color: colors.muted, fontSize: 12, lineHeight: 18, flexShrink: 1 },
  tags: { color: colors.brown, fontSize: 12, flexShrink: 1 },
  notice: { color: colors.danger, fontSize: 13, fontWeight: '700' },
  image: { maxHeight: 140, overflow: 'hidden', borderRadius: radius.md },
  pressed: { backgroundColor: colors.surface },
});
