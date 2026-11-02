import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/app-text';
import { DetailHeader, Screen } from '@/components/primitives';
import { fontSizes, useFontSizeStore, type FontSize } from '@/store/font-size-store';
import { colors, radius, spacing } from '@/theme/tokens';
import { useAppearanceStore, type ColorMode } from '@/store/appearance-store';

export default function FontSizeScreen() {
  const fontSize = useFontSizeStore((state) => state.fontSize);
  const setFontSize = useFontSizeStore((state) => state.setFontSize);
  const mode = useAppearanceStore((state) => state.mode);
  const setMode = useAppearanceStore((state) => state.setMode);
  return (
    <Screen>
      <DetailHeader title="介面調整" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>外觀</Text>
        <View style={styles.options}>
          {(
            [
              ['system', '跟隨系統'],
              ['light', '淺色'],
              ['dark', '深色'],
            ] as [ColorMode, string][]
          ).map(([value, label]) => (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityLabel={label}
              accessibilityState={{ checked: mode === value }}
              onPress={() => setMode(value)}
              style={[styles.option, mode === value && styles.selected]}
            >
              <Text style={styles.optionText}>{label}</Text>
              <MaterialCommunityIcons
                name={mode === value ? 'radiobox-marked' : 'radiobox-blank'}
                size={23}
                color={colors.muted}
              />
            </Pressable>
          ))}
        </View>
        <Text style={styles.heading}>文字大小</Text>
        <View style={styles.options}>
          {(Object.keys(fontSizes) as FontSize[]).map((size) => (
            <Pressable
              key={size}
              accessibilityRole="radio"
              accessibilityState={{ checked: fontSize === size }}
              accessibilityLabel={`App 字級：${fontSizes[size].label}`}
              onPress={() => setFontSize(size)}
              style={({ pressed }) => [
                styles.option,
                fontSize === size && styles.selected,
                pressed && styles.pressed,
              ]}
            >
              <Text fixedSize style={styles.optionText}>
                {fontSizes[size].label}
              </Text>
              <MaterialCommunityIcons
                name={fontSize === size ? 'radiobox-marked' : 'radiobox-blank'}
                size={23}
                color={fontSize === size ? colors.brown : colors.muted}
              />
            </Pressable>
          ))}
        </View>
        <Text style={styles.heading}>文字預覽</Text>
        <View style={styles.preview}>
          <Text style={styles.previewTitle}>一起揪團，分享好吃的！</Text>
          <Text style={styles.previewBody}>
            看看校園附近的拼單，和同學一起分享餐點。選擇上方字級，即可預覽閱讀效果。
          </Text>
          <Text style={styles.previewNote}>今天 18:30 截止 · 每人 NT$ 50</Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  intro: { color: colors.muted, fontSize: 14, lineHeight: 22, marginBottom: spacing.lg },
  options: { gap: spacing.sm },
  option: {
    minHeight: 54,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  optionText: { color: colors.ink, fontSize: 16, fontWeight: '600' },
  selected: { backgroundColor: colors.yellowSoft, borderColor: colors.yellow },
  pressed: { opacity: 0.6 },
  heading: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    color: colors.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  preview: {
    padding: spacing.lg,
    gap: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  previewTitle: { color: colors.ink, fontSize: 18, lineHeight: 27, fontWeight: '700' },
  previewBody: { color: colors.ink, fontSize: 16, lineHeight: 25 },
  previewNote: { color: colors.muted, fontSize: 13, lineHeight: 20 },
});
