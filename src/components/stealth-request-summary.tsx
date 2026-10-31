import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
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
const categoryIcons = {
  drink: 'cup-outline',
  meal: 'silverware-fork-knife',
  pizza: 'pizza',
  bakery: 'bread-slice-outline',
  snack: 'cookie-outline',
} as const;
export function StealthRequestSummary({
  signal,
  facts,
}: {
  signal: StealthSignalInput;
  facts?: StealthIntake['facts'];
}) {
  const range = [signal.starts_at, signal.ends_at]
    .map((value) => {
      const date = new Date(value);
      return Number.isFinite(date.getTime())
        ? date.toLocaleString('zh-TW', {
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          })
        : '待確認';
    })
    .join(' — ');
  const proposedLocation = !!facts && facts.location_id == null;
  const proposedTime = !!facts && (facts.delay_minutes == null || facts.duration_minutes == null);
  const items = [
    {
      icon: 'map-marker-outline' as const,
      text: `${proposedLocation ? '建議：' : ''}${stealthLocations[signal.location_id] ?? signal.location_id ?? '地點待確認'}`,
    },
    { icon: 'clock-outline' as const, text: `${proposedTime ? '建議時段：' : ''}${range}` },
    {
      icon: 'wallet-outline' as const,
      text: signal.budget_max_twd == null ? '預算待討論' : `每人預算上限 $${signal.budget_max_twd}`,
    },
    {
      icon: 'handshake-outline' as const,
      text: signal.roles?.length
        ? `我願意${signal.roles.map((role) => roles[role]).join('、')}`
        : facts?.roles_confirmed
          ? '本人暫不負責分工'
          : '分工待討論',
    },
  ];
  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <View style={styles.categoryIcon}>
          <MaterialCommunityIcons
            name={categoryIcons[signal.category] ?? 'account-group-outline'}
            size={24}
            color={colors.ink}
          />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.category}>{stealthCategories[signal.category]}</Text>
          <Text style={styles.title}>{signal.title}</Text>
        </View>
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
      <Text style={styles.note}>
        {signal.known_cost_twd == null
          ? '實際費用待協調，預算不代表報價。'
          : `目前已知費用：每人 NT$ ${signal.known_cost_twd}`}
      </Text>
      {proposedLocation || proposedTime ? (
        <Text style={styles.note}>
          標示「建議」的條件尚未由你提供；可以回到聊天更改，或確認採用。
        </Text>
      ) : null}
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
  heading: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  categoryIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.yellowSoft,
  },
  category: { fontSize: 11, lineHeight: 17, color: colors.muted },
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
