import { AppText as Text } from '@/components/app-text';
import { useState } from 'react';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Alert, FlatList, Modal, Pressable, RefreshControl, Share, StyleSheet, View } from 'react-native';
import { AppHeader, Avatar, EmptyState, IconButton, PrimaryButton, Screen } from '@/components/primitives';
import { useAppStore } from '@/store/app-store';
import { TagChip } from '@/components/tag-chip';
import { PostInfo } from '@/components/post-location';
import type { FeedPost } from '@/types/domain';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export default function HomeScreen() {
  const posts = useAppStore((state) => state.posts);
  const blocked = useAppStore((state) => state.blockedUserNames);
  const [refreshing, setRefreshing] = useState(false);
  const visiblePosts = posts.filter((post) => !blocked.includes(post.name));

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
  const [optionsVisible, setOptionsVisible] = useState(false);
  const interested = useAppStore((state) => state.interestedPostIds.includes(post.id));
  const toggleInterest = useAppStore((state) => state.toggleInterest);
  const dismissPost = useAppStore((state) => state.dismissPost);
  const dismissed = useAppStore((state) => state.dismissedPostIds.includes(post.id));
  const restorePost = useAppStore((state) => state.restorePost);
  const reminder = useAppStore((state) => state.reminderPostIds.includes(post.id));
  const toggleReminder = useAppStore((state) => state.toggleReminder);

  if (dismissed) {
    return (
      <View style={styles.dismissedPost}>
        <Text style={styles.dismissedText} accessibilityLiveRegion="polite">已隱藏這則貼文</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`取消隱藏 ${post.name} 的貼文`}
          onPress={() => restorePost(post.id)}
          style={({ pressed }) => [styles.undoButton, pressed && styles.undoPressed]}
        >
          <Text style={styles.undoText}>取消</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.post}>
      <View style={styles.authorRow}>
        <Pressable onPress={() => router.push(`/user/${encodeURIComponent(post.name)}`)}><Avatar name={post.name} badge={post.badge} size={44} /></Pressable>
        <Pressable onPress={() => router.push(`/user/${encodeURIComponent(post.name)}`)} style={styles.authorText}><View style={styles.nameRow}><Text numberOfLines={1} style={styles.authorName}>{post.name}</Text><Text style={styles.level}>{post.badge} Lv.{post.level}</Text></View><Text style={styles.time}>{post.time}</Text></Pressable>
        <IconButton icon="dots-horizontal" label="貼文選項" onPress={() => setOptionsVisible(true)} />
      </View>
      <Pressable onPress={() => router.push(`/post/${post.id}`)}><Text style={styles.content}>{post.content}</Text>{post.imageUrl && <Image source={post.imageUrl} contentFit="cover" transition={180} style={styles.postImage} />}</Pressable>
      <View style={styles.tags}>{post.tags.map((tag) => <TagChip key={tag} label={tag} onPress={() => router.push({ pathname: '/search', params: { scope: 'posts', query: tag } })} />)}</View>
      <PostInfo post={post} reminder={reminder} />
      <View style={styles.actions}>
        <PrimaryButton disabled={post.isMine} style={StyleSheet.flatten([styles.actionButton, interested && !post.isMine && styles.interestedActionButton])} textColor={interested && !post.isMine ? '#FFFFFF' : undefined} onPress={() => { toggleInterest(post.id); Alert.alert(interested ? '已取消' : '申請已送出', interested ? '你已取消想被揪。' : '主揪會收到你的申請。'); }}>{post.isMine ? '你的貼文' : interested ? '已想被揪' : '想被揪'}</PrimaryButton>
        <IconButton icon="share-variant-outline" label="分享貼文" onPress={() => Share.share({ message: `政缺一咖拼單：${post.content}` })} />
      </View>
      <Modal transparent animationType="fade" visible={optionsVisible} onRequestClose={() => setOptionsVisible(false)}>
        <View style={styles.optionsOverlay}>
          <Pressable accessibilityRole="button" accessibilityLabel="關閉貼文選項" style={StyleSheet.absoluteFill} onPress={() => setOptionsVisible(false)} />
          <View style={styles.optionsPanel} accessibilityViewIsModal>
            <Text style={styles.optionsTitle}>貼文選項</Text>
            <Pressable accessibilityRole="button" style={({ pressed }) => [styles.optionRow, pressed && styles.undoPressed]} onPress={() => { setOptionsVisible(false); dismissPost(post.id); }}>
              <Text style={styles.optionText}>沒興趣</Text>
            </Pressable>
            <Pressable accessibilityRole="button" style={({ pressed }) => [styles.optionRow, pressed && styles.undoPressed]} onPress={() => { setOptionsVisible(false); toggleReminder(post.id); }}>
              <Text style={styles.optionText}>{reminder ? '取消截止提醒' : '截止前 30 分鐘提醒'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" style={({ pressed }) => [styles.optionRow, pressed && styles.undoPressed]} onPress={() => { setOptionsVisible(false); Alert.alert('檢舉已送出', '管理員將審核這則內容。'); }}>
              <Text style={[styles.optionText, styles.reportText]}>檢舉貼文</Text>
            </Pressable>
            <PrimaryButton secondary onPress={() => setOptionsVisible(false)}>取消</PrimaryButton>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  feed: { paddingBottom: 120 },
  emptyFeed: { flexGrow: 1, paddingBottom: 120 },
  divider: { height: 1, backgroundColor: colors.border },
  post: { paddingHorizontal: spacing.lg, paddingVertical: 14 },
  dismissedPost: { minHeight: 52, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  dismissedText: { flex: 1, color: colors.muted, fontFamily: typography.regular, fontSize: 14 },
  undoButton: { minWidth: 44, minHeight: 44, paddingHorizontal: spacing.sm, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  undoPressed: { backgroundColor: colors.surface, opacity: 0.62 },
  undoText: { color: colors.brown, fontFamily: typography.rounded, fontSize: 15, fontWeight: '600' },
  authorRow: { flexDirection: 'row', alignItems: 'center' },
  authorText: { flex: 1, paddingLeft: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  authorName: { maxWidth: '70%', color: colors.ink, fontFamily: typography.rounded, fontSize: 16, fontWeight: '700' },
  level: { color: colors.muted, fontFamily: typography.regular, fontSize: 13 },
  time: { marginTop: 2, color: colors.muted, fontFamily: typography.regular, fontSize: 13 },
  content: { marginTop: 10, color: colors.ink, fontFamily: typography.regular, fontSize: 15, lineHeight: 22 },
  postImage: { width: '100%', aspectRatio: 1.3, marginTop: 10, borderRadius: radius.md, backgroundColor: '#F0E3CE' },
  tags: { marginTop: 9, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actions: { marginTop: 11, flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionButton: { flex: 1, minHeight: 42, paddingHorizontal: 8 },
  interestedActionButton: { backgroundColor: '#FF9114' },
  optionsOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, backgroundColor: 'rgba(0, 0, 0, 0.3)' },
  optionsPanel: { width: '100%', maxWidth: 360, padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.background },
  optionsTitle: { marginBottom: spacing.sm, color: colors.ink, fontFamily: typography.rounded, fontSize: 16, fontWeight: '700' },
  optionRow: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radius.sm },
  optionText: { color: colors.ink, fontFamily: typography.regular, fontSize: 15 },
  reportText: { color: colors.danger },
});
