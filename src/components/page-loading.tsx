import { ActivityIndicator, View, type ActivityIndicatorProps } from 'react-native';
import { colors } from '@/theme/tokens';

export function PageLoading(props: ActivityIndicatorProps) {
  return (
    <View
      style={{
        paddingHorizontal: 24,
        paddingVertical: 28,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ActivityIndicator {...props} color={colors.muted} />
    </View>
  );
}
