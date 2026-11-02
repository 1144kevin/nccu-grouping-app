import { AppText as Text } from '@/components/app-text';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import {
  Avatar,
  DetailHeader,
  EmptyState,
  IconButton,
  Pill,
  PrimaryButton,
  Screen,
  SectionTitle,
} from '@/components/primitives';
import { useAppStore } from '@/store/app-store';
import { CORE_API_ENABLED } from '@/lib/core-api';
import { CoreOrderDetail } from '@/components/core-order-detail';
import { colors, radius, spacing, typography, yellowSurface } from '@/theme/tokens';

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return CORE_API_ENABLED ? <CoreOrderDetail id={id} /> : <DemoOrderDetailScreen />;
}

function DemoOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const history = useAppStore((state) => state.history.find((item) => item.id === id));
  const post = useAppStore((state) => state.posts.find((item) => item.id === id));
  const allRequests = useAppStore((state) => state.requests);
  const requests = allRequests.filter((item) => item.postId === id);
  const updateRequest = useAppStore((state) => state.updateRequest);
  const title = history?.title ?? post?.content ?? requests[0]?.postTitle;
  if (!title)
    return (
      <Screen>
        <DetailHeader title="拼單詳情" />
        <EmptyState icon="clipboard-text-off-outline" title="找不到這筆拼單" />
      </Screen>
    );
  const status = history?.status ?? (post && post.joined === post.capacity ? '已成團' : '進行中');

  return (
    <Screen>
      <DetailHeader
        title="拼單詳情"
        right={
          <IconButton
            icon="dots-horizontal"
            label="拼單選項"
            onPress={() =>
              Alert.alert('拼單選項', title, [
                {
                  text: '分享拼單',
                  onPress: () => Share.share({ message: `政缺一咖拼單：${title}` }),
                },
                { text: '回報問題', onPress: () => router.push('/help') },
                { text: '取消', style: 'cancel' },
              ])
            }
          />
        }
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heading}>
          <View style={styles.emoji}>
            <Text fixedSize style={styles.emojiText}>
              {history?.emoji ?? post?.badge ?? '🍱'}
            </Text>
          </View>
          <View style={styles.headingText}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.detail}>
              {history?.detail ??
                `${post?.deadline ?? '今天'} · ${post?.joined ?? 1}/${post?.capacity ?? requests.length + 1} 人`}
            </Text>
          </View>
          <Pill tone={status === '進行中' ? 'yellow' : 'success'}>{status}</Pill>
        </View>
        <View style={styles.timeline}>
          <TimelineStep done label="已建立拼單" />
          <TimelineStep
            done={status !== '進行中'}
            label={status === '進行中' ? '等待成團' : '已確認成團'}
          />
          <TimelineStep done={status === '已完成'} label="完成面交" last />
        </View>
        <SectionTitle
          action={
            requests.length ? <Text style={styles.count}>{requests.length} 位申請</Text> : undefined
          }
        >
          團員與申請
        </SectionTitle>
        <Pressable onPress={() => router.push('/profile')} style={styles.member}>
          <Avatar name="Kevin" badge="🍜" size={42} />
          <View style={styles.memberText}>
            <Text style={styles.memberName}>Kevin</Text>
            <Text style={styles.memberMeta}>主揪 · 🍜 Lv.5</Text>
          </View>
          <Pill tone="yellow">主揪</Pill>
        </Pressable>
        {requests.map((request) => (
          <View key={request.id} style={styles.member}>
            <Pressable onPress={() => router.push(`/user/${encodeURIComponent(request.name)}`)}>
              <Avatar name={request.name} badge={request.badge} size={42} />
            </Pressable>
            <Pressable
              onPress={() => router.push(`/user/${encodeURIComponent(request.name)}`)}
              style={styles.memberText}
            >
              <Text style={styles.memberName}>{request.name}</Text>
              <Text style={styles.memberMeta}>
                {request.badge} Lv.{request.level} · {request.requestedAt}
              </Text>
            </Pressable>
            {request.status === 'pending' ? (
              <View style={styles.requestActions}>
                <IconButton
                  icon="close"
                  label={`拒絕 ${request.name}`}
                  onPress={() => confirmStatus('拒絕', () => updateRequest(request.id, 'rejected'))}
                />
                <PrimaryButton
                  style={styles.accept}
                  onPress={() => updateRequest(request.id, 'accepted')}
                >
                  接受
                </PrimaryButton>
              </View>
            ) : (
              <Pill tone={request.status === 'accepted' ? 'success' : 'danger'}>
                {request.status === 'accepted' ? '已接受' : '已拒絕'}
              </Pill>
            )}
          </View>
        ))}
        {!requests.length ? <Text style={styles.empty}>這筆紀錄沒有待處理的申請</Text> : null}
        <SectionTitle>面交資訊</SectionTitle>
        <View style={styles.infoRow}>
          <MaterialCommunityIcons name="map-marker-outline" size={18} color={colors.yellow} />
          <View>
            <Text style={styles.infoTitle}>取餐地點</Text>
            <Text style={styles.infoText}>政大校門口，成團後請在聊天室再次確認</Text>
          </View>
        </View>
        <View style={styles.infoRow}>
          <MaterialCommunityIcons name="shield-check-outline" size={18} color={colors.yellow} />
          <View>
            <Text style={styles.infoTitle}>交易提醒</Text>
            <Text style={styles.infoText}>勿提前提供帳戶密碼或驗證碼，付款前確認品項與金額。</Text>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

function TimelineStep({
  done,
  label,
  last = false,
}: {
  done: boolean;
  label: string;
  last?: boolean;
}) {
  return (
    <View style={styles.step}>
      <View style={styles.stepMarker}>
        <View style={[styles.dot, done && styles.dotDone]}>
          {done ? <MaterialCommunityIcons name="check" size={11} color={colors.ink} /> : null}
        </View>
        {!last ? <View style={[styles.line, done && styles.lineDone]} /> : null}
      </View>
      <Text style={[styles.stepText, done && styles.stepTextDone]}>{label}</Text>
    </View>
  );
}

function confirmStatus(action: string, onConfirm: () => void) {
  Alert.alert(`${action}這位申請者？`, '處理後仍會保留紀錄。', [
    { text: '取消', style: 'cancel' },
    { text: action, style: 'destructive', onPress: onConfirm },
  ]);
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  emoji: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: '#F2E5CC',
  },
  emojiText: { fontSize: 27 },
  headingText: { flex: 1 },
  title: {
    color: colors.ink,
    fontFamily: typography.rounded,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 21,
  },
  detail: { marginTop: 5, color: colors.muted, fontSize: 13 },
  timeline: {
    marginVertical: spacing.xl,
    padding: spacing.lg,
    flexDirection: 'row',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  step: { flex: 1, alignItems: 'center' },
  stepMarker: { width: '100%', alignItems: 'center' },
  dot: {
    width: 22,
    height: 22,
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 11,
    backgroundColor: colors.background,
  },
  dotDone: { borderColor: colors.yellow, ...yellowSurface, backgroundColor: colors.yellow },
  line: {
    position: 'absolute',
    top: 10,
    left: '50%',
    width: '100%',
    height: 2,
    backgroundColor: colors.border,
  },
  lineDone: { ...yellowSurface, backgroundColor: colors.yellow },
  stepText: { marginTop: spacing.sm, color: colors.muted, fontSize: 12, textAlign: 'center' },
  stepTextDone: { color: colors.ink, fontWeight: '600' },
  count: { color: colors.muted, fontSize: 13 },
  member: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  memberText: { flex: 1 },
  memberName: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  memberMeta: { marginTop: 3, color: colors.muted, fontSize: 13 },
  requestActions: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  accept: { minHeight: 34, paddingHorizontal: spacing.md },
  empty: { paddingVertical: spacing.xl, color: colors.muted, fontSize: 14, textAlign: 'center' },
  infoRow: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoTitle: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  infoText: { maxWidth: 350, marginTop: 4, color: colors.muted, fontSize: 15, lineHeight: 23 },
});
