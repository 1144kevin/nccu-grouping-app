import { MessageHostButton } from '@/components/message-host-button';
import { ReputationBadge } from '@/components/reputation-badge';
import { AppText as Text } from '@/components/app-text';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Alert, Modal, Pressable, Share, StyleSheet, View } from 'react-native';
import { Avatar, IconButton, PrimaryButton } from '@/components/primitives';
import { useAppStore } from '@/store/app-store';
import { PostInfo } from '@/components/post-location';
import { CORE_SUPABASE_MODE, coreError, type CorePost } from '@/lib/core-api';
import {
  engagementApi,
  useSavedPostPreferences,
  type SavedPostPreference,
} from '@/lib/engagement-api';
import { queryClient } from '@/lib/query-client';
import { useAuthStore } from '@/store/auth-store';
import { CorePostActions } from '@/components/core-post-actions';
import { PostShareButton } from '@/components/post-share-button';
import { CorePostGallery, PhotoCarousel } from '@/components/post-photo-carousel';
import { CoreRecommendationReasons } from '@/components/core-recommendation-reasons';
import type { FeedPost } from '@/types/domain';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export function FeedPostCard({
  post,
  corePost,
  respectHidden = true,
  onManage,
  showManagement = true,
}: {
  post: FeedPost;
  corePost?: CorePost;
  respectHidden?: boolean;
  onManage?: () => void;
  showManagement?: boolean;
}) {
  const [optionsVisible, setOptionsVisible] = useState(false);
  const interested = useAppStore((state) => state.interestedPostIds.includes(post.id));
  const toggleInterest = useAppStore((state) => state.toggleInterest);
  const dismissPost = useAppStore((state) => state.dismissPost);
  const dismissed = useAppStore((state) => state.dismissedPostIds.includes(post.id));
  const restorePost = useAppStore((state) => state.restorePost);
  const demoReminder = useAppStore((state) => state.reminderPostIds.includes(post.id));
  const toggleReminder = useAppStore((state) => state.toggleReminder);
  const actor = useAuthStore((state) => state.user?.id);
  const saved = useSavedPostPreferences();
  const preference = saved.data?.items.find((item) => item.post_id === post.id);
  const cloudPreference = !!corePost && CORE_SUPABASE_MODE;
  const reminder = cloudPreference ? (preference?.reminder ?? false) : demoReminder;
  const updatePreference = useMutation({
    mutationFn: (value: { hidden: boolean; reminder: boolean }) =>
      engagementApi.savePost(post.id, value),
    onSuccess: (updated) => {
      if (useAuthStore.getState().user?.id !== actor) return;
      queryClient.setQueryData<{ items: SavedPostPreference[] }>(
        ['core', actor, 'saved-posts'],
        (old) => ({
          items: [
            ...(old?.items.filter((item) => item.post_id !== updated.post_id) ?? []),
            updated,
          ],
        }),
      );
    },
  });
  const authorPath = `/user/${encodeURIComponent(corePost?.author_id ?? post.name)}` as const;

  if (respectHidden && (cloudPreference ? preference?.hidden : !corePost && dismissed)) {
    return (
      <View style={styles.dismissedPost}>
        <Text style={styles.dismissedText} accessibilityLiveRegion="polite">
          已隱藏這則貼文
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`取消隱藏 ${post.name} 的貼文`}
          disabled={updatePreference.isPending}
          onPress={() =>
            cloudPreference
              ? updatePreference.mutate({ hidden: false, reminder })
              : restorePost(post.id)
          }
          style={({ pressed }) => [styles.undoButton, pressed && styles.undoPressed]}
        >
          <Text style={styles.undoText}>取消</Text>
        </Pressable>
        {updatePreference.error ? (
          <Text accessibilityRole="alert">{coreError(updatePreference.error)}</Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.post}>
      <View style={styles.authorRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`查看 ${post.name} 的公開資料`}
          onPress={() => router.push(authorPath)}
        >
          <Avatar name={post.name} badge={post.badge} userId={corePost?.author_id} size={44} />
        </Pressable>
        <Pressable onPress={() => router.push(authorPath)} style={styles.authorText}>
          <View style={styles.nameRow}>
            <Text numberOfLines={1} style={styles.authorName}>
              {post.name}
            </Text>
            <ReputationBadge level={post.level} />
          </View>
          <Text style={styles.time}>{post.time}</Text>
        </Pressable>
        <IconButton
          icon="dots-horizontal"
          label="貼文選項"
          onPress={() => setOptionsVisible(true)}
        />
      </View>
      <View>
        <Text style={styles.content}>{post.content}</Text>
        {corePost?.images?.length || corePost?.image_id ? (
          <CorePostGallery post={corePost!} />
        ) : post.photos?.length ? (
          <PhotoCarousel photos={post.photos} />
        ) : (
          post.imageUrl && (
            <Image
              source={post.imageUrl}
              contentFit="contain"
              transition={180}
              style={styles.postImage}
            />
          )
        )}
      </View>
      <View style={styles.tags}>
        {post.tags.map((tag) => (
          <Pressable
            key={tag}
            accessibilityRole="button"
            onPress={() =>
              router.push({ pathname: '/search', params: { scope: 'posts', query: tag } })
            }
          >
            <Text style={{ color: colors.brown, fontSize: 15, fontWeight: '700' }}>#{tag}</Text>
          </Pressable>
        ))}
      </View>
      <PostInfo post={post} reminder={reminder} compact />
      {corePost ? <CoreRecommendationReasons post={corePost} /> : null}
      {updatePreference.error ? (
        <Text accessibilityRole="alert" style={{ color: colors.danger }}>
          {coreError(updatePreference.error)}
        </Text>
      ) : null}
      {corePost?.is_demo ? <Text style={styles.time}>示範資料 · 沒有真實訂購</Text> : null}
      {corePost && (corePost.completed || corePost.status !== 'open') ? (
        <Text style={styles.time}>
          {corePost.completed
            ? '已完成'
            : corePost.status === 'cancelled'
              ? '已取消'
              : corePost.status === 'expired'
                ? '已截止'
                : '已額滿'}
        </Text>
      ) : null}
      <View style={styles.actions}>
        {corePost ? (
          corePost.my_status === 'host' && !showManagement ? (
            corePost.can_edit && ['open', 'full'].includes(corePost.status) ? (
              <PrimaryButton
                secondary
                style={{ flex: 1 }}
                onPress={() => router.push(`/edit-post/${corePost.id}`)}
              >
                編輯拼單
              </PrimaryButton>
            ) : null
          ) : (
            <CorePostActions post={corePost} onManage={onManage} />
          )
        ) : (
          <PrimaryButton
            disabled={post.isMine}
            style={StyleSheet.flatten([
              styles.actionButton,
              interested && !post.isMine && styles.interestedActionButton,
            ])}
            textColor={interested && !post.isMine ? '#FFFFFF' : undefined}
            onPress={() => {
              toggleInterest(post.id);
              Alert.alert(
                interested ? '已取消' : '申請已送出',
                interested ? '你已取消想被揪。' : '主揪會收到你的申請。',
              );
            }}
          >
            {post.isMine ? '你的貼文' : interested ? '已想被揪' : '想被揪'}
          </PrimaryButton>
        )}
        {corePost ? <MessageHostButton post={corePost} compact /> : null}
        {corePost ? (
          <PostShareButton postId={corePost.id} content={post.content} />
        ) : (
          <IconButton
            icon="share-variant-outline"
            label="分享貼文"
            onPress={() => Share.share({ message: `政缺一咖拼單：${post.content}` })}
          />
        )}
      </View>
      <Modal
        transparent
        animationType="fade"
        visible={optionsVisible}
        onRequestClose={() => setOptionsVisible(false)}
      >
        <View style={styles.optionsOverlay}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="關閉貼文選項"
            style={StyleSheet.absoluteFill}
            onPress={() => setOptionsVisible(false)}
          />
          <View style={styles.optionsPanel} accessibilityViewIsModal>
            <Text style={styles.optionsTitle}>貼文選項</Text>
            <Pressable
              accessibilityRole="button"
              disabled={
                !!corePost && (!cloudPreference || !saved.data || updatePreference.isPending)
              }
              style={({ pressed }) => [styles.optionRow, pressed && styles.undoPressed]}
              onPress={() => {
                setOptionsVisible(false);
                if (cloudPreference) updatePreference.mutate({ hidden: true, reminder });
                else dismissPost(post.id);
              }}
            >
              <Text style={styles.optionText}>沒興趣</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={
                !!corePost && (!cloudPreference || !saved.data || updatePreference.isPending)
              }
              style={({ pressed }) => [styles.optionRow, pressed && styles.undoPressed]}
              onPress={() => {
                setOptionsVisible(false);
                if (cloudPreference)
                  updatePreference.mutate({
                    hidden: preference?.hidden ?? false,
                    reminder: !reminder,
                  });
                else toggleReminder(post.id);
              }}
            >
              <Text style={styles.optionText}>
                {corePost
                  ? reminder
                    ? '取消 App 內截止提醒'
                    : '加入 App 內截止提醒（非推播）'
                  : reminder
                    ? '取消截止提醒'
                    : '截止前 30 分鐘提醒'}
              </Text>
            </Pressable>
            {!(corePost
              ? corePost.my_status === 'host' || corePost.author_id === actor
              : post.isMine) ? (
              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [styles.optionRow, pressed && styles.undoPressed]}
                onPress={() => {
                  setOptionsVisible(false);
                  if (corePost)
                    router.push({
                      pathname: '/report',
                      params: { kind: 'post', targetId: corePost.id },
                    });
                  else Alert.alert('展示模式', '檢舉不會傳送到後端。');
                }}
              >
                <Text style={[styles.optionText, styles.reportText]}>檢舉貼文</Text>
              </Pressable>
            ) : null}
            <PrimaryButton secondary onPress={() => setOptionsVisible(false)}>
              取消
            </PrimaryButton>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  post: { paddingHorizontal: spacing.lg, paddingVertical: 14 },
  dismissedPost: {
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  dismissedText: { flex: 1, color: colors.muted, fontFamily: typography.regular, fontSize: 14 },
  undoButton: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  undoPressed: { backgroundColor: colors.surface, opacity: 0.62 },
  undoText: {
    color: colors.brown,
    fontFamily: typography.rounded,
    fontSize: 15,
    fontWeight: '600',
  },
  authorRow: { flexDirection: 'row', alignItems: 'center' },
  authorText: { flex: 1, paddingLeft: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  authorName: {
    maxWidth: '70%',
    color: colors.ink,
    fontFamily: typography.rounded,
    fontSize: 16,
    fontWeight: '700',
  },
  time: { marginTop: 2, color: colors.muted, fontFamily: typography.regular, fontSize: 13 },
  content: {
    marginTop: 10,
    color: colors.ink,
    fontFamily: typography.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  postImage: {
    width: '100%',
    aspectRatio: 1.3,
    marginTop: 10,
    borderRadius: radius.md,
    backgroundColor: '#F0E3CE',
  },
  tags: { marginTop: 9, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actions: { marginTop: 11, flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionButton: { flex: 1, minHeight: 42, paddingHorizontal: 8 },
  interestedActionButton: { backgroundColor: '#FF9114' },
  optionsOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  optionsPanel: {
    width: '100%',
    maxWidth: 360,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.background,
  },
  optionsTitle: {
    marginBottom: spacing.sm,
    color: colors.ink,
    fontFamily: typography.rounded,
    fontSize: 16,
    fontWeight: '700',
  },
  optionRow: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  optionText: { color: colors.ink, fontFamily: typography.regular, fontSize: 15 },
  reportText: { color: colors.danger },
});
