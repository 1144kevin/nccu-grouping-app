import { useState } from 'react';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Alert, FlatList, Pressable, RefreshControl, Share, StyleSheet, Text, View } from 'react-native';
import { AppHeader, Avatar, EmptyState, IconButton, Pill, PrimaryButton, Screen } from '@/components/primitives';
import { useAppStore } from '@/store/app-store';
import type { FeedPost } from '@/types/domain';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export default function HomeScreen() {
  const posts = useAppStore((state) => state.posts);
  const dismissed = useAppStore((state) => state.dismissedPostIds);
  const blocked = useAppStore((state) => state.blockedUserNames);
  const [refreshing, setRefreshing] = useState(false);
  const visiblePosts = posts.filter((post) => !dismissed.includes(post.id) && !blocked.includes(post.name));

  async function refresh() {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 550));
    setRefreshing(false);
  }

  return (
    <Screen>
      <AppHeader searchScope="posts" />
      <FlatList
        data={visiblePosts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PostItem post={item} />}
        ItemSeparatorComponent={() => <View style={styles.divider} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.yellow} />}
        ListEmptyComponent={<EmptyState icon="text-box-search-outline" title="目前沒有可顯示的拼單" action={<PrimaryButton secondary onPress={() => router.push('/search')}>前往搜尋</PrimaryButton>} />}
        contentContainerStyle={visiblePosts.length ? styles.feed : styles.emptyFeed}
      />
    </Screen>
  );
}

function PostItem({ post }: { post: FeedPost }) {
  const interested = useAppStore((state) => state.interestedPostIds.includes(post.id));
  const toggleInterest = useAppStore((state) => state.toggleInterest);
  const dismissPost = useAppStore((state) => state.dismissPost);
  const reminder = useAppStore((state) => state.reminderPostIds.includes(post.id));
  const toggleReminder = useAppStore((state) => state.toggleReminder);

  function openOptions() {
    Alert.alert('貼文選項', post.name, [
      { text: reminder ? '取消截止提醒' : '截止前 30 分鐘提醒', onPress: () => toggleReminder(post.id) },
      { text: '隱藏貼文', onPress: () => dismissPost(post.id) },
      { text: '檢舉貼文', style: 'destructive', onPress: () => Alert.alert('檢舉已送出', '管理員將審核這則內容。') },
      { text: '取消', style: 'cancel' },
    ]);
  }

  return (
    <View style={styles.post}>
      <View style={styles.authorRow}>
        <Pressable onPress={() => router.push(`/user/${encodeURIComponent(post.name)}`)}><Avatar name={post.name} badge={post.badge} size={44} /></Pressable>
        <Pressable onPress={() => router.push(`/user/${encodeURIComponent(post.name)}`)} style={styles.authorText}><View style={styles.nameRow}><Text numberOfLines={1} style={styles.authorName}>{post.name}</Text><Text style={styles.level}>{post.badge} Lv.{post.level}</Text></View><Text style={styles.time}>{post.time}</Text></Pressable>
        <IconButton icon="dots-vertical" label="貼文選項" onPress={openOptions} />
      </View>
      <Pressable onPress={() => router.push(`/post/${post.id}`)}><Text style={styles.content}>{post.content}</Text>{post.imageUrl && <Image source={post.imageUrl} contentFit="cover" transition={180} style={styles.postImage} />}</Pressable>
      <View style={styles.tags}>{post.tags.map((tag) => <Pressable key={tag} onPress={() => router.push({ pathname: '/search', params: { scope: 'posts', query: tag } })}><Text style={styles.tag}>#{tag}</Text></Pressable>)}</View>
      <View style={styles.meta}><Pill icon="clock-outline">{post.deadline}</Pill><Pill icon="account-group-outline">{post.joined}/{post.capacity}</Pill>{reminder ? <Pill tone="yellow" icon="bell-ring-outline">已提醒</Pill> : null}</View>
      <View style={styles.actions}>
        <PrimaryButton disabled={post.isMine} style={styles.actionButton} onPress={() => { toggleInterest(post.id); Alert.alert(interested ? '已取消' : '申請已送出', interested ? '你已取消想被揪。' : '主揪會收到你的申請。'); }}>{post.isMine ? '你的貼文' : interested ? '已想被揪' : '想被揪'}</PrimaryButton>
        <PrimaryButton secondary style={styles.actionButton} onPress={() => dismissPost(post.id)}>沒興趣</PrimaryButton>
        <IconButton icon="share-variant-outline" label="分享貼文" onPress={() => Share.share({ message: `政缺一咖拼單：${post.content}` })} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  feed: { paddingBottom: spacing.lg },
  emptyFeed: { flexGrow: 1 },
  divider: { height: 1, backgroundColor: colors.border },
  post: { paddingHorizontal: spacing.lg, paddingVertical: 14 },
  authorRow: { flexDirection: 'row', alignItems: 'center' },
  authorText: { flex: 1, paddingLeft: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  authorName: { maxWidth: '70%', color: colors.ink, fontFamily: typography.rounded, fontSize: 14, fontWeight: '700' },
  level: { color: colors.muted, fontFamily: typography.regular, fontSize: 11 },
  time: { marginTop: 2, color: colors.muted, fontFamily: typography.regular, fontSize: 11 },
  content: { marginTop: 10, color: colors.ink, fontFamily: typography.regular, fontSize: 15, lineHeight: 22 },
  postImage: { width: '100%', aspectRatio: 1.3, marginTop: 10, borderRadius: radius.md, backgroundColor: '#F0E3CE' },
  tags: { marginTop: 9, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tag: { color: colors.brown, fontFamily: typography.rounded, fontSize: 12, fontWeight: '600' },
  meta: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actions: { marginTop: 11, flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionButton: { flex: 1, paddingHorizontal: 8 },
});
