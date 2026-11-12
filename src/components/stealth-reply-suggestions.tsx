import { useEffect, useState } from 'react';
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
  collapsed = false,
  onSelect,
  onPlan,
}: {
  id: string;
  actor: string;
  contextKey: string;
  enabled: boolean;
  disabled: boolean;
  collapsed?: boolean;
  onSelect: (text: string) => void;
  onPlan?: () => void;
}) {
  const [replies, setReplies] = useState(() => pick());
  const [manualOpen, setManualOpen] = useState(false);
  useEffect(() => {
    setManualOpen(false);
  }, [collapsed]);
  if (!enabled) return null;
  const minimized = collapsed && !manualOpen;
  return (
    <View style={[styles.panel, minimized && styles.panelMinimized]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={minimized ? '展開回覆建議' : '回覆建議'}
          disabled={!collapsed}
          onPress={() => setManualOpen((open) => !open)}
          style={styles.titleWrap}
        >
          <Text style={styles.title}>回覆建議</Text>
          {collapsed ? (
            <Text style={styles.toggleHint}>{minimized ? '展開' : '收起'}</Text>
          ) : null}
        </Pressable>
        <View style={styles.actions}>
          {!minimized ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="換一批回覆建議"
              onPress={() => setReplies((old) => pick(old))}
              style={[styles.action, collapsed && styles.actionCompact]}
            >
              <Text style={styles.link}>換一批</Text>
            </Pressable>
          ) : null}
          {onPlan ? (
            <Pressable
              accessibilityRole="button"
              disabled={disabled}
              onPress={onPlan}
              style={[styles.action, minimized && styles.actionCompact]}
            >
              <Text style={styles.link}>填寫拼單</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      {!minimized ? (
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
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  panel: { padding: spacing.sm, gap: 4, borderTopWidth: 1, borderTopColor: colors.border },
  panelMinimized: { paddingVertical: 4, paddingHorizontal: spacing.sm, gap: 0 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toggleHint: { color: colors.muted, fontSize: 12 },
  actions: { flexDirection: 'row', alignItems: 'center' },
  title: { color: colors.ink, fontWeight: '700', fontSize: 14 },
  action: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm },
  actionCompact: { minHeight: 32 },
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
