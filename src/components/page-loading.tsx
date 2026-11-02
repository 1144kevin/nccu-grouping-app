import { ActivityIndicator, View, type ActivityIndicatorProps } from 'react-native';
import { colors } from '@/theme/tokens';

export function PageLoading(props: ActivityIndicatorProps) {
  return (
    <View
      style={{
        flex: 1,
        alignSelf: 'stretch',
        minHeight: 80,
        paddingHorizontal: 24,
        paddingVertical: 28,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ActivityIndicator
        accessible
        accessibilityRole="progressbar"
        accessibilityState={{ busy: true }}
        accessibilityLabel="載入中"
        {...props}
        color={colors.muted}
      />
    </View>
  );
}
