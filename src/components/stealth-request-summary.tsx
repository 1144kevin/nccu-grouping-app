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
}: {
  signal: StealthSignalInput;
  facts?: StealthIntake['facts'];
  createdAt?: string;
  onClose?: () => void;
  closing?: boolean;
  closeDisabled?: boolean;
}) {
  const range = [signal.starts_at, signal.ends_at]
    .map((value) => {
      const date = new Date(value);
      return Number.isFinite(date.getTime()) ? displayTimestamp(value) : '待確認';
    })
    .join(' — ');
  const proposedLocation = !!facts && facts.location_id == null;
  const items = [
    {
      icon: 'map-marker-outline' as const,
      text: `${proposedLocation ? '建議：' : ''}${stealthLocations[signal.location_id] ?? signal.location_id ?? '地點待確認'}`,
    },
    { icon: 'clock-outline' as const, text: `可接受時段：${range}` },
    {
      icon: 'wallet-outline' as const,
      text:
        signal.budget_max_twd == null
          ? '預算先依餐點價格評估'
          : `每人可接受金額 $${signal.budget_max_twd} 以內`,
    },
    {
      icon: 'handshake-outline' as const,
      text:
        signal.participation_preference === 'receive'
          ? '偏好原地收餐，分攤自己的餐費' +
            (signal.roles?.filter((role) => role !== 'share').length
              ? `；願意${signal.roles
                  .filter((role) => role !== 'share')
                  .map((role) => roles[role])
                  .join('、')}`
              : '')
          : signal.roles?.length
            ? `我願意${signal.roles.map((role) => roles[role]).join('、')}`
            : '分攤自己的餐費，暫不承擔下單與取餐',
    },
  ];
  return (
    <View style={styles.card}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <Text style={[styles.title, { flex: 1 }]}>{signal.title}</Text>
        {onClose ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`停止需求：${signal.title}`}
            disabled={closeDisabled}
            onPress={onClose}
            hitSlop={10}
            style={{ width: 30, height: 30, alignItems: 'center', justifyContent: 'center' }}
          >
            {closing ? (
              <ActivityIndicator size="small" color={colors.danger} />
            ) : (
              <MaterialCommunityIcons name="close" size={20} color={colors.danger} />
            )}
          </Pressable>
        ) : null}
      </View>
      <View style={styles.items}>
        {items.map(({ icon, text }) => (
          <View key={icon} style={styles.item}>
            <View style={styles.itemIcon}>
              <MaterialCommunityIcons name={icon} size={17} color={colors.muted} />
            </View>
            <Text style={styles.body}>{text}</Text>
          </View>
        ))}
      </View>
      {signal.known_cost_twd != null ? (
        <Text style={styles.note}>目前每人費用 NT$ {signal.known_cost_twd}</Text>
      ) : null}
      <Text style={styles.note}>
        {createdAt
          ? `新增於 ${displayTimestamp(createdAt)} · 保留24小時`
          : '暫定條件，可回到聊天調整；確認新增後保留24小時。'}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    gap: 16,
    borderRadius: 20,
    padding: 18,
    backgroundColor: '#FFFEF8',
    borderWidth: 1,
    borderColor: '#EAE6D9',
    borderLeftWidth: 4,
    borderLeftColor: colors.yellow,
  },
  itemIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F0E8',
  },
  title: { fontSize: 17, lineHeight: 26, fontWeight: '700', color: colors.ink },
  items: { gap: 10 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  body: { flex: 1, fontSize: 14, lineHeight: 22, color: colors.ink },
  note: { fontSize: 12, lineHeight: 19, color: colors.muted },
});
