import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/app-text';
import { colors, spacing, yellowSurface } from '@/theme/tokens';

export const COMMON_REPLIES = [
  '你想要什麼品項？',
  '什麼時候方便？',
  '在哪裡取貨比較方便？',
  '每人預算大概多少？',
  '誰方便幫忙購買？',
  '誰方便幫忙取貨？',
  '費用要怎麼分攤？',
  '我們先確認一下細節吧！',
];
function pick(previous: string[] = []): string[] {
  const shuffled = [...COMMON_REPLIES];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  const fresh = shuffled.filter((item) => !previous.includes(item));
  return [...fresh, ...shuffled.filter((item) => previous.includes(item))].slice(0, 3);
}
export function StealthReplySuggestions({
  enabled,
  disabled,
  onSelect,
  onPlan,
}: {
  id: string;
  actor: string;
  contextKey: string;
  enabled: boolean;
  disabled: boolean;
  onSelect: (text: string) => void;
  onPlan?: () => void;
}) {
  const [replies, setReplies] = useState(() => pick());
  if (!enabled) return null;
  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.title}>回覆建議</Text>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="換一批回覆建議"
            onPress={() => setReplies((old) => pick(old))}
            style={styles.action}
          >
            <Text style={styles.link}>換一批</Text>
          </Pressable>
          {onPlan ? (
            <Pressable
              accessibilityRole="button"
              disabled={disabled}
              onPress={onPlan}
              style={styles.action}
            >
              <Text style={styles.link}>填寫拼單</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.cards}
      >
        {replies.map((text, index) => (
          <Pressable
            key={text}
            accessibilityRole="button"
            accessibilityLabel={`使用建議 ${index + 1}：${text}`}
            disabled={disabled}
            onPress={() => onSelect(text)}
            style={styles.card}
          >
            <Text style={styles.reply}>{text}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  panel: { padding: spacing.sm, gap: 4, borderTopWidth: 1, borderTopColor: colors.border },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', alignItems: 'center' },
  title: { color: colors.ink, fontWeight: '700', fontSize: 14 },
  action: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm },
  link: { color: colors.brown, fontSize: 13, fontWeight: '700' },
  cards: { gap: spacing.sm, paddingVertical: 6 },
  card: {
    width: 250,
    padding: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...yellowSurface,
    backgroundColor: colors.yellowSoft,
  },
  reply: { color: colors.ink, fontSize: 14, lineHeight: 21 },
});
