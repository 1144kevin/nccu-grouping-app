import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/app-text';
import { stealthApi } from '@/lib/stealth-api';
import { colors, spacing } from '@/theme/tokens';

export function StealthReplySuggestions({ id, actor, contextKey, enabled, disabled, onSelect }: {
  id: string; actor: string; contextKey: string; enabled: boolean; disabled: boolean;
  onSelect: (text: string) => void;
}) {
  // The parent remounts on a new authorized chat snapshot; old suggestions disappear.
  const [settled, setSettled] = useState(false);
  const [batch, setBatch] = useState(0);
  const [previous, setPrevious] = useState<string[]>([]);
  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => setSettled(true), 700);
    return () => clearTimeout(timer);
  }, [enabled]);
  const query = useQuery({
    queryKey: ['core', actor, 'stealth', 'reply-suggestions', id, contextKey, batch],
    queryFn: ({ signal }) => stealthApi.replySuggestions(id, batch, signal, previous),
    enabled: enabled && settled,
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
  if (!enabled) return null;
  return <View style={styles.panel}>
    <View style={styles.header}>
      <Text style={styles.title}>{query.data?.is_llm ? '✦ AI 回覆建議' : '✦ 回覆建議'}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="換一批回覆建議" disabled={!settled || query.isFetching || batch >= 10000}
        onPress={() => { setPrevious(query.data?.suggestions ?? previous); setBatch((value) => value + 1); }} style={styles.refresh}>
        <Text style={styles.link}>{query.isFetching ? '產生中…' : '換一批'}</Text>
      </Pressable>
    </View>
    <Text style={styles.hint}>依配對與最新對話更新，點選後可修改，再按傳送。</Text>
    {query.data ? <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.cards}>
      {query.data.suggestions.map((text, index) => <Pressable key={text} accessibilityRole="button" accessibilityLabel={`使用建議 ${index + 1}：${text}`}
        disabled={disabled} onPress={() => onSelect(text)} style={styles.card}>
        <Text style={styles.reply}>{text}</Text>
      </Pressable>)}
    </ScrollView> : <Text accessibilityRole={query.error ? 'alert' : undefined} style={styles.hint}>
      {query.error ? '建議暫時無法更新，請換一批重試；仍可自行輸入訊息。' : '正在整理最新對話的回覆建議…'}
    </Text>}
    {query.data && !query.data.is_llm ? <Text style={styles.hint}>目前提供一般協調問句。</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  panel: { padding: spacing.sm, gap: 4, borderTopWidth: 1, borderTopColor: colors.border },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.ink, fontWeight: '700', fontSize: 14 },
  refresh: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm },
  link: { color: colors.brown, fontSize: 13, fontWeight: '700' },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  cards: { gap: spacing.sm, paddingVertical: 6 },
  card: { width: 250, padding: spacing.sm, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.yellowSoft },
  reply: { color: colors.ink, fontSize: 14, lineHeight: 21 },
});
