import { useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/app-text';
import {
  AppHeader,
  Avatar,
  EmptyState,
  Pill,
  PrimaryButton,
  Screen,
  SectionTitle,
} from '@/components/primitives';
import { BurgerLevelIcon, type BurgerLevel } from '@/components/burger-level-icon';
import { useCorePosts } from '@/lib/core-hooks';
import { useExperience } from '@/lib/social-api';
import { coreError, type CorePost } from '@/lib/core-api';
import { useAuthStore } from '@/store/auth-store';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export function postEmoji(post: Pick<CorePost, 'content' | 'tags'>) {
  const s = post.tags.join('') + post.content;
  return /飲料|喝|茶|咖啡/.test(s)
    ? '🧋'
    : /披薩/.test(s)
      ? '🍕'
      : /麵包|可頌/.test(s)
        ? '🥐'
        : '🍱';
}
export function CoreProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const history = useCorePosts('history', '', false, 5);
  const experience = useExperience();
  const [help, setHelp] = useState(false);
  if (!user) return null;
  const level = experience.data?.level ?? 1;
  const score = experience.data?.score;
  const labels = ['一分熟', '二分熟', '三分熟', '四分熟', '五分熟'];
  return (
    <Screen>
      <AppHeader searchScope="history" />
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="編輯個人資料"
          onPress={() => router.push('/edit-profile')}
          style={styles.identity}
        >
          <Avatar name={user.display_name} badge={user.badge ?? '🍱'} size={76} />
          <View style={styles.identityText}>
            <Text style={styles.username}>{user.display_name}</Text>
            <Text style={styles.joined}>
              {new Date(user.created_at).toLocaleDateString('zh-TW', {
                year: 'numeric',
                month: 'long',
              })}
              加入
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <BurgerLevelIcon level={level} size={30} />
              <Text style={styles.role}>
                {experience.data ? `${labels[level - 1]}揪團夥伴` : '揪團新朋友'}
              </Text>
            </View>
            <Text style={styles.bio}>{user.bio || '寫點介紹，讓夥伴認識你'}</Text>
          </View>
          <MaterialCommunityIcons name="pencil-outline" size={17} color={colors.subtle} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="熟度等級說明"
          onPress={() => setHelp(true)}
          style={styles.levelCard}
        >
          <View style={styles.levelTitle}>
            <Text style={styles.levelHeading}>我的熟度等級</Text>
            <Text style={styles.levelName}>
              {experience.data ? `${labels[level - 1]} (Lv.${level})` : '待累積'}
            </Text>
            <MaterialCommunityIcons name="information-outline" size={16} color={colors.muted} />
          </View>
          <View style={styles.progressRow}>
            <View style={styles.progressTrack}>
              <View style={[styles.progress, { width: `${score ?? 0}%` }]} />
            </View>
            <Text style={styles.score}>{score == null ? '—' : score}/100</Text>
          </View>
          <View style={styles.levels}>
            {([1, 2, 3, 4, 5] as BurgerLevel[]).map((value) => (
              <View key={value} style={styles.levelItem}>
                <BurgerLevelIcon level={value} size={48} />
                <Text style={styles.levelLabel}>Lv.{value}</Text>
              </View>
            ))}
          </View>
        </Pressable>
        <SectionTitle
          action={
            <Text style={styles.count}>
              {history.posts.length}
              {history.hasNextPage ? '+' : ''} 筆
            </Text>
          }
        >
          過往拼單
        </SectionTitle>
        {history.error ? (
          <Text accessibilityRole="alert" style={{ color: colors.danger }}>
            {coreError(history.error)}
          </Text>
        ) : null}
        {history.isPending ? (
          <ActivityIndicator />
        ) : history.posts.length ? (
          history.posts.map((post) => (
            <HistoryRow
              key={post.id}
              post={post}
              completed={experience.data?.completed_post_ids.includes(post.id)}
            />
          ))
        ) : (
          <EmptyState icon="clipboard-text-outline" title="還沒有過往拼單" />
        )}
        {history.hasNextPage ? (
          <PrimaryButton
            secondary
            disabled={history.isFetchingNextPage}
            onPress={() => {
              void history.fetchNextPage();
            }}
          >
            載入更多
          </PrimaryButton>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/settings')}
          style={styles.settingsButton}
        >
          <MaterialCommunityIcons name="shield-account-outline" size={18} color={colors.ink} />
          <Text style={styles.settingsText}>帳號與隱私設定</Text>
          <MaterialCommunityIcons name="chevron-right" size={17} color={colors.subtle} />
        </Pressable>
      </ScrollView>
      <Modal transparent visible={help} animationType="fade" onRequestClose={() => setHelp(false)}>
        <View style={styles.overlay}>
          <View style={styles.help}>
            <Text style={styles.username}>一起把漢堡疊高</Text>
            <Text style={styles.bio}>
              每筆拼單在所有團員確認完成面交後累積 10 分，上限 100
              分。尚未完成、取消與示範拼單不計分。
            </Text>
            <Text style={styles.bio}>熟度反映已確認的參與紀錄，不是付款保證。</Text>
            <PrimaryButton onPress={() => setHelp(false)}>知道了</PrimaryButton>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
export function HistoryRow({ post, completed = false }: { post: CorePost; completed?: boolean }) {
  const status = completed
    ? '已完成'
    : post.status === 'cancelled'
      ? '已取消'
      : post.status === 'expired'
        ? '已截止'
        : '進行中';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`查看紀錄 ${post.content}`}
      onPress={() => router.push(`/order/${post.id}`)}
      style={styles.historyRow}
    >
      <View style={styles.historyImage}>
        <Text fixedSize style={styles.historyEmoji}>
          {postEmoji(post)}
        </Text>
      </View>
      <View style={styles.historyText}>
        <Text numberOfLines={2} style={styles.historyTitle}>
          {post.content.split('\n')[0]}
        </Text>
        <Text style={styles.historyDetail}>
          {new Date(post.created_at).toLocaleDateString('zh-TW', { month: 'long', day: 'numeric' })}{' '}
          · {post.joined}/{post.capacity} 人
        </Text>
      </View>
      <Pill tone={completed ? 'success' : 'plain'}>{status}</Pill>
      <MaterialCommunityIcons name="chevron-right" size={17} color={colors.muted} />
    </Pressable>
  );
}
const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 120 },
  identity: { flexDirection: 'row', alignItems: 'center' },
  identityText: { flex: 1, marginLeft: 14 },
  username: { color: colors.ink, fontFamily: typography.rounded, fontSize: 22, fontWeight: '800' },
  joined: { marginTop: 4, color: colors.muted, fontSize: 13 },
  role: {
    marginTop: 5,
    color: colors.brown,
    fontFamily: typography.rounded,
    fontSize: 15,
    fontWeight: '700',
  },
  bio: { marginTop: 5, color: colors.muted, fontSize: 14, lineHeight: 21 },
  levelCard: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    marginBottom: 12,
  },
  levelTitle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  levelHeading: { flex: 1, color: colors.ink, fontFamily: typography.rounded, fontWeight: '700' },
  levelName: {
    color: colors.brown,
    fontFamily: typography.rounded,
    fontSize: 15,
    fontWeight: '700',
  },
  progressRow: { marginTop: 15, flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressTrack: {
    flex: 1,
    height: 8,
    overflow: 'hidden',
    borderRadius: 4,
    backgroundColor: colors.surface,
  },
  progress: { height: '100%', borderRadius: 4, backgroundColor: colors.yellow },
  score: { color: colors.ink, fontSize: 13 },
  levels: { marginTop: 15, flexDirection: 'row', justifyContent: 'space-between' },
  levelItem: { alignItems: 'center', gap: 3 },
  levelLabel: { color: colors.muted, fontSize: 12 },
  count: { color: colors.muted, fontSize: 14 },
  historyRow: {
    minHeight: 88,
    marginBottom: 9,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  historyImage: {
    width: 68,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2E5CC',
  },
  historyEmoji: { fontSize: 33 },
  historyText: { flex: 1, minWidth: 0, paddingHorizontal: 12 },
  historyTitle: {
    color: colors.ink,
    fontFamily: typography.rounded,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
  },
  historyDetail: { marginTop: 5, color: colors.muted, fontSize: 12 },
  settingsButton: {
    minHeight: 50,
    marginTop: 10,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  settingsText: { flex: 1, color: colors.ink, fontSize: 15, fontWeight: '700' },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00000055',
    padding: 24,
  },
  help: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: 20,
    gap: 14,
    maxWidth: 400,
    width: '100%',
  },
});
