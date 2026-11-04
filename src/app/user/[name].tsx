import { AppText as Text } from '@/components/app-text';
import { levelLabel } from '@/lib/level-label';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Avatar, DetailHeader, EmptyState, IconButton, PrimaryButton, Screen, SectionTitle } from '@/components/primitives';
import { useAppStore } from '@/store/app-store';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { CORE_API_ENABLED } from '@/lib/core-api';
import { CorePublicProfile } from '@/components/core-public-profile';
import { pizzaLevels } from '@/components/pizza-level-icon';

export default function UserProfileScreen() {
  const params = useLocalSearchParams<{ name: string }>();
  return CORE_API_ENABLED ? <CorePublicProfile id={params.name ?? ''} /> : <DemoUserProfileScreen />;
}

function DemoUserProfileScreen() {
  const params = useLocalSearchParams<{ name: string }>();
  const name = decodeURIComponent(params.name);
  const allPosts = useAppStore((state) => state.posts);
  const posts = allPosts.filter((item) => item.name === name);
  const conversation = useAppStore((state) => state.conversations.find((item) => item.name === name));
  const request = useAppStore((state) => state.requests.find((item) => item.name === name));
  const blocked = useAppStore((state) => state.blockedUserNames.includes(name));
  const toggleBlocked = useAppStore((state) => state.toggleBlockedUser);
  const startConversation = useAppStore((state) => state.startConversation);
  const identity = posts[0] ?? conversation ?? request;
  if (!identity) return <Screen><DetailHeader title="使用者" /><EmptyState icon="account-question-outline" title="找不到這位使用者" /></Screen>;
  const badge = identity.badge;
  const level = identity.level;

  function message() { const id = startConversation(name, badge, level); router.push(`/chat/${id}`); }
  function block() { Alert.alert(blocked ? '解除封鎖？' : '封鎖這位使用者？', blocked ? `解除後，${name} 可以再次與你互動。` : '封鎖後將隱藏對方內容與新訊息。', [{ text: '取消', style: 'cancel' }, { text: blocked ? '解除封鎖' : '封鎖', style: blocked ? 'default' : 'destructive', onPress: () => toggleBlocked(name) }]); }

  return (
    <Screen>
      <DetailHeader title="個人檔案" right={<IconButton icon="dots-horizontal" label="使用者選項" onPress={() => Alert.alert('使用者選項', name, [{ text: blocked ? '解除封鎖' : '封鎖使用者', style: 'destructive', onPress: block }, { text: '檢舉使用者', style: 'destructive', onPress: () => Alert.alert('已送出檢舉', '管理員將檢視近期公開內容。') }, { text: '取消', style: 'cancel' }])} />} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}><Avatar name={name} badge={badge} size={78} /><Text style={styles.name}>{name}</Text><Text style={styles.level}>{badge} {levelLabel(level)} · {levelName(level)}</Text><Text style={styles.meta}>已完成 {Math.max(3, level * 4)} 次拼單</Text></View>
        {blocked ? <View style={styles.blocked}><MaterialCommunityIcons name="account-cancel-outline" size={18} color={colors.danger} /><Text style={styles.blockedText}>你已封鎖這位使用者</Text></View> : null}
        <View style={styles.actions}><PrimaryButton disabled={blocked} style={styles.action} onPress={message}>傳送訊息</PrimaryButton><PrimaryButton secondary style={styles.action} onPress={block}>{blocked ? '解除封鎖' : '封鎖'}</PrimaryButton></View>
        <View style={styles.stats}><View style={styles.stat}><Text style={styles.statValue}>{Math.max(3, level * 4)}</Text><Text style={styles.statLabel}>完成拼單</Text></View><View style={styles.stat}><Text style={styles.statValue}>98%</Text><Text style={styles.statLabel}>準時回覆</Text></View><View style={styles.stat}><Text style={styles.statValue}>{level}.0</Text><Text style={styles.statLabel}>互動評價</Text></View></View>
        <SectionTitle>公開拼單</SectionTitle>
        {posts.length ? posts.map((post) => <Pressable key={post.id} onPress={() => router.push(`/post/${post.id}`)} style={styles.post}><View style={styles.postIcon}><Text>{post.badge}</Text></View><View style={styles.postText}><Text numberOfLines={2} style={styles.postTitle}>{post.content}</Text><Text style={styles.postMeta}>{post.deadline} · {post.joined}/{post.capacity} 人</Text></View><MaterialCommunityIcons name="chevron-right" size={17} color={colors.subtle} /></Pressable>) : <Text style={styles.noPosts}>目前沒有公開進行中的拼單</Text>}
      </ScrollView>
    </Screen>
  );
}

function levelName(level: number) { return pizzaLevels[Math.min(4, Math.max(0, level - 1))].title; }

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  hero: { alignItems: 'center', paddingVertical: spacing.lg },
  name: { marginTop: spacing.md, color: colors.ink, fontFamily: typography.rounded, fontSize: 20, fontWeight: '800' },
  level: { marginTop: 5, color: colors.brown, fontSize: 14, fontWeight: '700' },
  meta: { marginTop: 5, color: colors.muted, fontSize: 13 },
  blocked: { minHeight: 40, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radius.md, backgroundColor: '#FFF2F2' },
  blockedText: { color: colors.danger, fontSize: 14 },
  actions: { marginTop: spacing.md, flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1 },
  stats: { marginVertical: spacing.xl, paddingVertical: spacing.lg, flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { color: colors.ink, fontFamily: typography.rounded, fontSize: 17, fontWeight: '800' },
  statLabel: { marginTop: 4, color: colors.muted, fontSize: 13 },
  post: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  postIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: '#F2E5CC' },
  postText: { flex: 1 },
  postTitle: { color: colors.ink, fontSize: 15, fontWeight: '600', lineHeight: 21 },
  postMeta: { marginTop: 4, color: colors.muted, fontSize: 13 },
  noPosts: { paddingVertical: spacing.xl, color: colors.muted, textAlign: 'center', fontSize: 14 },
});
