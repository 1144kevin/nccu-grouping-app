import { Pressable, StyleSheet } from 'react-native';
import { AppText } from '@/components/app-text';
import { colors, radius, typography, yellowSurface } from '@/theme/tokens';

export function TagChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={selected === undefined ? undefined : { selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.selected, pressed && styles.pressed]}
    >
      <AppText style={styles.text}>
        {selected ? '✓  ' : ''}
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 36,
    maxWidth: '100%',
    paddingHorizontal: 13,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.yellow,
    borderRadius: radius.md,
  },
  selected: { ...yellowSurface, backgroundColor: colors.yellowSoft },
  pressed: { opacity: 0.6 },
  text: { color: colors.ink, fontFamily: typography.regular, fontSize: 15 },
});
