import { ActivityIndicator, View, type StyleProp, type TextStyle } from 'react-native';
import { AppText as Text } from '@/components/app-text';
import { colors } from '@/theme/tokens';

export function InlineLoading({
  label = '處理中',
  textStyle,
}: {
  label?: string;
  textStyle?: StyleProp<TextStyle>;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <ActivityIndicator
        accessible
        size="small"
        color={colors.muted}
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        accessibilityState={{ busy: true }}
      />
      <Text style={textStyle}>{label}</Text>
    </View>
  );
}
