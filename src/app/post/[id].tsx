import { AppText as Text } from '@/components/app-text';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { Avatar, DetailHeader, EmptyState, IconButton, PrimaryButton, Screen } from '@/components/primitives';
import { useAppStore } from '@/store/app-store';
import { PostInfo } from '@/components/post-location';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const post = useAppStore((state) => state.posts.find((item) => item.id === id));
  const interested = useAppStore((state) => state.interestedPostIds.includes(id));
  const reminder = useAppStore((state) => state.reminderPostIds.includes(id));
  const toggleInterest = useAppStore((state) => state.toggleInterest);
  const toggleReminder = useAppStore((state) => state.toggleReminder);
  if (!post) return <Screen><DetailHeader title="貼文內容" /><EmptyState icon="text-box-remove-outline" title="這則貼文不存在或已結束" /></Screen>;

  function report() { Alert.alert('檢舉貼文', '我們會將這則內容交由管理員審核。', [{ text: '取消', style: 'cancel' }, { text: '送出檢舉', style: 'destructive', onPress: () => Alert.alert('已收到檢舉', '感謝你協助維護社群安全。') }]); }

  return (
    <Screen>
      <DetailHeader title="貼文內容" right={<IconButton icon="dots-horizontal" label="更多選項" onPress={() => Alert.alert('貼文選項', post.name, [{ text: reminder ? '取消截止提醒' : '設定截止提醒', onPress: () => toggleReminder(post.id) }, { text: '檢舉貼文', style: 'destructive', onPress: report }, { text: '取消', style: 'cancel' }])} />} />
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.push(`/user/${encodeURIComponent(post.name)}`)} style={styles.author}><Avatar name={post.name} badge={post.badge} size={46} /><View style={styles.authorText}><Text style={styles.name}>{post.name}</Text><Text style={styles.level}>{post.badge} Lv.{post.level} · {post.time}</Text></View><MaterialCommunityIcons name="chevron-right" size={17} color={colors.subtle} /></Pressable>
        <Text style={styles.body}>{post.content}</Text>
        {post.imageUrl ? <Image source={post.imageUrl} contentFit="cover" style={styles.image} /> : null}
        <View style={styles.tags}>{post.tags.map((tag) => <Pressable key={tag} onPress={() => router.push({ pathname: '/search', params: { scope: 'posts', query: tag } })}><Text style={styles.tag}>#{tag}</Text></Pressable>)}</View>
        <PostInfo post={post} reminder={reminder} />
        <View style={styles.divider} />
        <View style={styles.summary}><Text style={styles.summaryTitle}>加入前請確認</Text><Text style={styles.summaryText}>送出「想被揪」後，主揪可以接受或拒絕申請。被接受後請透過聊天室確認費用、取餐時間與地點。</Text></View>
      </ScrollView>
      <View style={styles.bottom}><IconButton icon={reminder ? 'bell-off-outline' : 'bell-outline'} label={reminder ? '取消提醒' : '設定提醒'} onPress={() => toggleReminder(post.id)} /><IconButton icon="share-variant-outline" label="分享貼文" onPress={() => Share.share({ message: `政缺一咖拼單：${post.content}` })} /><PrimaryButton disabled={post.isMine} style={styles.joinButton} onPress={() => { toggleInterest(post.id); Alert.alert(interested ? '已取消申請' : '申請已送出', interested ? '這則拼單已從想被揪清單移除。' : '主揪接受後會通知你。'); }}>{post.isMine ? '這是你的貼文' : interested ? '取消想被揪' : '想被揪'}</PrimaryButton></View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 100 },
  author: { flexDirection: 'row', alignItems: 'center' },
  authorText: { flex: 1, marginLeft: spacing.md },
  name: { color: colors.ink, fontFamily: typography.rounded, fontSize: 16, fontWeight: '700' },
  level: { marginTop: 3, color: colors.muted, fontSize: 13 },
  body: { marginTop: spacing.lg, color: colors.ink, fontFamily: typography.regular, fontSize: 16, lineHeight: 24 },
  image: { width: '100%', aspectRatio: 1.3, marginTop: spacing.lg, borderRadius: radius.md, backgroundColor: colors.surface },
  tags: { marginTop: spacing.md, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tag: { color: colors.brown, fontSize: 14, fontWeight: '600' },
  divider: { height: 1, marginVertical: spacing.xl, backgroundColor: colors.border },
  summary: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface },
  summaryTitle: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  summaryText: { marginTop: spacing.sm, color: colors.muted, fontSize: 15, lineHeight: 23 },
  bottom: { minHeight: 70, paddingHorizontal: spacing.md, paddingBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
  joinButton: { flex: 1 },
});
