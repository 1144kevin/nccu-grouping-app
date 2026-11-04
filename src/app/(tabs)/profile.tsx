import { AppText as Text } from '@/components/app-text';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppHeader, Avatar, Pill, Screen, SectionTitle } from '@/components/primitives';
import { PizzaLevelIcon, type PizzaLevel } from '@/components/pizza-level-icon';
import { useAppStore } from '@/store/app-store';
import { CORE_API_ENABLED } from '@/lib/core-api';
import { CoreProfileScreen } from '@/components/core-profile';
import type { OrderHistory } from '@/types/domain';
import { colors, radius, spacing, typography, yellowSurface } from '@/theme/tokens';

const levels: PizzaLevel[] = [1, 2, 3, 4, 5];

export default function ProfileScreen() {
  return CORE_API_ENABLED ? <CoreProfileScreen /> : <DemoProfileScreen />;
}

function DemoProfileScreen() {
  const history = useAppStore((state) => state.history);
  const currentUser = useAppStore((state) => state.currentUser);
  return (
    <Screen>
      <AppHeader searchScope="history" />
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.push('/edit-profile')} style={styles.identity}>
          <Avatar name={currentUser.name} badge={currentUser.badge} size={76} />
          <View style={styles.identityText}>
            <Text style={styles.username}>{currentUser.name}</Text>
            <Text style={styles.joined}>{currentUser.joinedAt}加入</Text>
            <Text style={styles.role}>{currentUser.badge} 五分熟揪團高手</Text>
            <Text numberOfLines={1} style={styles.bio}>
              {currentUser.bio}
            </Text>
          </View>
          <MaterialCommunityIcons name="pencil-outline" size={16} color={colors.subtle} />
        </Pressable>
        <Pressable
          onPress={() => router.push({ pathname: '/help', params: { topic: 'level' } })}
          style={styles.levelCard}
        >
          <View style={styles.levelTitle}>
            <Text style={styles.levelHeading}>我的熟度等級</Text>
            <Text style={styles.levelName}>五分熟 (Lv.5)</Text>
            <MaterialCommunityIcons name="information-outline" size={15} color={colors.muted} />
          </View>
          <View style={styles.progressRow}>
            <View style={styles.progressTrack}>
              <View style={styles.progress} />
            </View>
            <Text style={styles.score}>98/100</Text>
          </View>
          <View style={styles.levels}>
            {levels.map((level) => (
              <View key={level} style={styles.levelItem}>
                <PizzaLevelIcon level={level} />
                <Text style={styles.levelLabel}>Lv.{level}</Text>
              </View>
            ))}
          </View>
        </Pressable>
        <SectionTitle action={<Text style={styles.count}>{history.length} 筆</Text>}>
          過往拼單
        </SectionTitle>
        {history.map((item) => (
          <HistoryRow key={item.id} item={item} />
        ))}
        <Pressable onPress={() => router.push('/settings')} style={styles.settingsButton}>
          <MaterialCommunityIcons name="shield-account-outline" size={18} color={colors.ink} />
          <Text style={styles.settingsText}>帳號與隱私設定</Text>
          <MaterialCommunityIcons name="chevron-right" size={17} color={colors.subtle} />
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

function HistoryRow({ item }: { item: OrderHistory }) {
  return (
    <Pressable onPress={() => router.push(`/order/${item.id}`)} style={styles.historyRow}>
      <View style={styles.historyImage}>
        <Text fixedSize style={styles.historyEmoji}>
          {item.emoji}
        </Text>
      </View>
      <View style={styles.historyText}>
        <Text numberOfLines={2} style={styles.historyTitle}>
          {item.title}
        </Text>
        <Text style={styles.historyDetail}>{item.detail}</Text>
      </View>
      <Pill tone={item.status === '進行中' ? 'yellow' : 'plain'}>{item.status}</Pill>
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
  bio: { marginTop: 5, color: colors.muted, fontSize: 14 },
  levelCard: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
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
  progress: {
    width: '98%',
    height: '100%',
    borderRadius: 4,
    ...yellowSurface,
    backgroundColor: colors.yellow,
  },
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
    width: 78,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2E5CC',
  },
  historyEmoji: { fontSize: 37 },
  historyText: { flex: 1, paddingHorizontal: 12 },
  historyTitle: {
    color: colors.ink,
    fontFamily: typography.rounded,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
  },
  historyDetail: { marginTop: 5, color: colors.muted, fontSize: 13 },
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
});
