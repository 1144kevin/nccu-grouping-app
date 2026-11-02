import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { colors } from '@/theme/tokens';

export function ChatSendButton({
  onPress,
  disabled,
  loading,
}: {
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="傳送"
      accessibilityState={{ busy: !!loading, disabled: !!disabled || !!loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={{
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: colors.yellow,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.muted} accessibilityLabel="正在傳送" />
      ) : (
        <MaterialCommunityIcons name="send" size={21} color={colors.ink} />
      )}
    </Pressable>
  );
}
export function ChatAddButton({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  return (
    <View
      style={{
        borderWidth: 1.5,
        borderColor: colors.muted,
        borderRadius: 20,
        width: 34,
        height: 34,
        margin: 4,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="傳送照片"
        onPress={onPress}
        disabled={disabled}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
      >
        <MaterialCommunityIcons name="plus" size={23} color={colors.ink} />
      </Pressable>
    </View>
  );
}
