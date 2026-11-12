import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { displayTimestamp } from '@/lib/display-time';
import { AppText as Text } from '@/components/app-text';
import type { StealthIntake, StealthSignalInput } from '@/lib/stealth-api';
import { colors } from '@/theme/tokens';

export const stealthLocations: Record<string, string> = {
  main_gate: '政大正門',
  east_gate: '東側門',
  south_gate: '南門',
};
export const stealthCategories = {
  drink: '喝飲料',
  meal: '吃正餐',
  pizza: '吃披薩',
  bakery: '麵包',
  snack: '點心零食',
};
const roles = { order: '下單', pickup: '取餐', coupon: '提供優惠券', share: '一起分食' };
export function StealthRequestSummary({
  signal,
  facts,
  createdAt,
  onClose,
  closing,
  closeDisabled,
  compact = true,
}: {
  signal: StealthSignalInput;
  facts?: StealthIntake['facts'];
  createdAt?: string;
  onClose?: () => void;
  closing?: boolean;
  closeDisabled?: boolean;
  compact?: boolean;
}) {
  const isFlexibleWindow =
    facts?.delay_minutes === 0 && facts?.duration_minutes === 1440;
  const range = isFlexibleWindow
    ? '都可以（24小時內）'
    : [signal.starts_at, signal.ends_at]
        .map((value) => {
          const date = new Date(value);
          return Number.isFinite(date.getTime()) ? displayTimestamp(value) : '都可以';
        })
        .join(' — ');
  const proposedLocation = !!facts && facts.location_id == null;
  const tagBonus = (signal.tags ?? [])
    .filter((tag) => tag.startsWith('BONUS:') || tag.startsWith('行程:') || tag.startsWith('優惠:'))
    .map((tag) => tag.replace(/^(BONUS|行程|優惠):/, '').trim())
    .filter(Boolean)
    .join('、');
  const explicitBonus = facts?.bonus?.trim() || tagBonus;
  const roleSummary = signal.roles?.length
    ? `我願意${signal.roles.map((role) => roles[role]).join('、')}`
    : '';
  const bonusText = explicitBonus
    ? roleSummary && !explicitBonus.includes(roleSummary.replace(/^我願意/, ''))
      ? `${explicitBonus}（${roleSummary}）`
      : explicitBonus
    : signal.participation_preference === 'receive'
      ? '偏好原地收餐，分攤自己的餐費' +
        (signal.roles?.filter((role) => role !== 'share').length
          ? `；願意${signal.roles
              .filter((role) => role !== 'share')
              .map((role) => roles[role])
              .join('、')}`
          : '')
      : roleSummary || '都可以';
  const items = [
    {
      icon: 'map-marker-outline' as const,
      label: null as string | null,
      text: `${proposedLocation ? '建議：' : ''}${stealthLocations[signal.location_id] ?? signal.location_id ?? '都可以'}`,
    },
    {
      icon: 'clock-outline' as const,
      label: null as string | null,
      text: `可接受時段：${range}`,
    },
    {
      icon: 'wallet-outline' as const,
      label: null as string | null,
      text:
        signal.budget_max_twd == null
          ? '都可以（預算先依餐點價格評估）'
          : `每人可接受金額 $${signal.budget_max_twd} 以內`,
    },
    {
      icon: 'star-four-points-outline' as const,
      label: 'BONUS',
      text: bonusText,
    },
  ];
  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <Text style={[styles.title, compact && styles.titleCompact, { flex: 1 }]}>
          {signal.title}
        </Text>
        {onClose ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`停止需求：${signal.title}`}
            disabled={closeDisabled}
            onPress={onClose}
            hitSlop={10}
            style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}
          >
            {closing ? (
              <ActivityIndicator size="small" color={colors.danger} />
            ) : (
              <MaterialCommunityIcons name="close" size={18} color={colors.danger} />
            )}
          </Pressable>
        ) : null}
      </View>
      <View style={[styles.items, compact && styles.itemsCompact]}>
        {items.map(({ icon, label, text }) => (
          <View key={icon} style={styles.item}>
            <View style={[styles.itemIcon, compact && styles.itemIconCompact]}>
              <MaterialCommunityIcons name={icon} size={compact ? 15 : 17} color={colors.muted} />
            </View>
            {label ? (
              <View style={styles.bonusBadge}>
                <Text style={styles.bonusBadgeText}>{label}</Text>
              </View>
            ) : null}
            <Text style={[styles.body, compact && styles.bodyCompact]}>{text}</Text>
          </View>
        ))}
      </View>
      {signal.known_cost_twd != null ? (
        <Text style={styles.note}>目前每人費用 NT$ {signal.known_cost_twd}</Text>
      ) : null}
      <Text style={styles.note}>
        {createdAt
          ? `新增於 ${displayTimestamp(createdAt)} · 保留24小時`
          : '暫定條件，確認同意後保留24小時。'}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    gap: 14,
    borderRadius: 18,
    padding: 16,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.yellow,
  },
  cardCompact: {
    gap: 10,
    borderRadius: 16,
    padding: 12,
    maxWidth: 340,
  },
  itemIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  itemIconCompact: {
    width: 24,
    height: 24,
    borderRadius: 8,
  },
  bonusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: colors.yellowSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bonusBadgeText: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
    color: colors.brown,
    letterSpacing: 0.4,
  },
  title: { fontSize: 17, lineHeight: 26, fontWeight: '700', color: colors.ink },
  titleCompact: { fontSize: 15, lineHeight: 22 },
  items: { gap: 10 },
  itemsCompact: { gap: 6 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  body: { flex: 1, fontSize: 14, lineHeight: 22, color: colors.ink },
  bodyCompact: { fontSize: 13, lineHeight: 19 },
  note: { fontSize: 11, lineHeight: 17, color: colors.muted },
});
