import { View } from 'react-native';
import { AppText as Text } from '@/components/app-text';
import { BurgerLevelIcon, type BurgerLevel } from '@/components/burger-level-icon';
import { colors } from '@/theme/tokens';

export function ReputationBadge({ level = 1 }: { level?: number }) {
  const value = Math.max(1, Math.min(5, Math.trunc(level))) as BurgerLevel;
  return (
    <View
      accessibilityLabel={`信譽熟度 Lv.${value}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 }}
    >
      <BurgerLevelIcon level={value} size={25} />
      <Text style={{ color: colors.brown, fontSize: 12 }}>Lv.{value}</Text>
    </View>
  );
}
