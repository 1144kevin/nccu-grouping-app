import { AppText as Text, AppTextInput as TextInput } from '@/components/app-text';
import { useMemo, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { type Href, router, useLocalSearchParams } from 'expo-router';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Avatar, EmptyState, IconButton, Screen } from '@/components/primitives';
import { useAppStore } from '@/store/app-store';
import { CORE_API_ENABLED } from '@/lib/core-api';
import { CoreSearchScreen } from '@/components/core-search';
import { colors, radius, spacing, typography } from '@/theme/tokens';

type ResultType = 'post' | 'user' | 'message' | 'order';
type SearchResult = { id: string; type: ResultType; title: string; detail: string; badge?: string; href: Href };
const filterOptions: { label: string; value: 'all' | ResultType }[] = [{ label: '全部', value: 'all' }, { label: '貼文', value: 'post' }, { label: '使用者', value: 'user' }, { label: '訊息', value: 'message' }, { label: '拼單', value: 'order' }];

export default function SearchScreen() {
  const { query } = useLocalSearchParams<{ query?: string }>();
  return CORE_API_ENABLED ? <CoreSearchScreen initialQuery={query ?? ''} /> : <DemoSearchScreen />;
}

function DemoSearchScreen() {
  const params = useLocalSearchParams<{ scope?: string; query?: string }>();
  const posts = useAppStore((state) => state.posts);
  const conversations = useAppStore((state) => state.conversations);
  const requests = useAppStore((state) => state.requests);
  const history = useAppStore((state) => state.history);
  const [query, setQuery] = useState(params.query ?? '');
  const [filter, setFilter] = useState<'all' | ResultType>(() => scopeToFilter(params.scope));
  const popularTags = useMemo(() => [...new Set(posts.flatMap((post) => post.tags))].slice(0, 8), [posts]);
  const results = useMemo<SearchResult[]>(() => {
    const keyword = query.trim().toLocaleLowerCase();
    if (!keyword) return [];
    const matches = (value: string) => value.toLocaleLowerCase().includes(keyword);
    const people = new Map<string, { badge: string; level: number }>();
    posts.forEach((item) => people.set(item.name, { badge: item.badge, level: item.level }));
    conversations.forEach((item) => people.set(item.name, { badge: item.badge, level: item.level }));
    requests.forEach((item) => people.set(item.name, { badge: item.badge, level: item.level }));
    return [
      ...posts.filter((item) => matches(item.content) || item.tags.some(matches) || matches(item.name)).map((item): SearchResult => ({ id: `post-${item.id}`, type: 'post', title: item.content, detail: `${item.name} · ${item.deadline}`, badge: item.badge, href: `/post/${item.id}` })),
      ...[...people.entries()].filter(([name]) => matches(name)).map(([name, value]): SearchResult => ({ id: `user-${name}`, type: 'user', title: name, detail: `${value.badge} Lv.${value.level}`, badge: value.badge, href: `/user/${encodeURIComponent(name)}` })),
      ...conversations.filter((item) => matches(item.name) || matches(item.preview)).map((item): SearchResult => ({ id: `message-${item.id}`, type: 'message', title: item.name, detail: item.preview, badge: item.badge, href: `/chat/${item.id}` })),
      ...history.filter((item) => matches(item.title) || matches(item.detail)).map((item): SearchResult => ({ id: `order-${item.id}`, type: 'order', title: item.title, detail: `${item.detail} · ${item.status}`, badge: item.emoji, href: `/order/${item.id}` })),
    ].filter((item) => filter === 'all' || item.type === filter);
  }, [conversations, filter, history, posts, query, requests]);

  return (
    <Screen>
      <View style={styles.header}><IconButton icon="chevron-left" label="返回" onPress={() => router.back()} /><View style={styles.inputWrap}><MaterialCommunityIcons name="magnify" size={18} color={colors.muted} /><TextInput autoFocus returnKeyType="search" value={query} onChangeText={setQuery} placeholder="搜尋拼單、使用者或訊息" placeholderTextColor={colors.subtle} style={styles.input} />{query ? <IconButton icon="close-circle" label="清除搜尋" onPress={() => setQuery('')} /> : null}</View></View>
      <View style={styles.filters}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent}>{filterOptions.map((item) => <Pressable key={item.value} onPress={() => setFilter(item.value)} style={[styles.filter, filter === item.value && styles.filterActive]}><Text style={[styles.filterText, filter === item.value && styles.filterTextActive]}>{item.label}</Text></Pressable>)}</ScrollView></View>
      {query.trim() ? <FlatList keyboardShouldPersistTaps="handled" data={results} keyExtractor={(item) => item.id} contentContainerStyle={results.length ? styles.results : styles.emptyResults} ListHeaderComponent={results.length ? <Text style={styles.resultCount}>{results.length} 筆搜尋結果</Text> : null} ListEmptyComponent={<EmptyState icon="magnify-close" title={`找不到「${query.trim()}」`} />} renderItem={({ item }) => <ResultRow item={item} />} /> : <ScrollView contentContainerStyle={styles.discovery}><Text style={styles.sectionTitle}>熱門搜尋</Text><View style={styles.tags}>{popularTags.map((tag) => <Pressable key={tag} onPress={() => { setQuery(tag); setFilter('post'); }} style={styles.tag}><MaterialCommunityIcons name="trending-up" size={14} color={colors.brown} /><Text style={styles.tagText}>{tag}</Text></Pressable>)}</View><Text style={styles.sectionTitle}>快速尋找</Text><Pressable onPress={() => { setQuery('今天'); setFilter('post'); }} style={styles.quickRow}><MaterialCommunityIcons name="clock-fast" size={19} color={colors.yellow} /><View style={styles.quickText}><Text style={styles.quickTitle}>即將截止</Text><Text style={styles.quickDetail}>查看今天仍可加入的拼單</Text></View><MaterialCommunityIcons name="chevron-right" size={17} color={colors.subtle} /></Pressable><Pressable onPress={() => { setQuery('政大附近'); setFilter('post'); }} style={styles.quickRow}><MaterialCommunityIcons name="map-marker-outline" size={19} color={colors.yellow} /><View style={styles.quickText}><Text style={styles.quickTitle}>校園附近</Text><Text style={styles.quickDetail}>尋找方便取餐的需求</Text></View><MaterialCommunityIcons name="chevron-right" size={17} color={colors.subtle} /></Pressable></ScrollView>}
    </Screen>
  );
}

function ResultRow({ item }: { item: SearchResult }) {
  const icon = item.type === 'post' ? 'text-box-outline' : item.type === 'message' ? 'message-outline' : item.type === 'order' ? 'format-list-checks' : undefined;
  return <Pressable onPress={() => router.push(item.href)} style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}>{item.type === 'user' ? <Avatar name={item.title} badge={item.badge ?? '🍜'} size={42} /> : <View style={styles.resultIcon}>{item.badge ? <Text style={styles.resultEmoji}>{item.badge}</Text> : <MaterialCommunityIcons name={icon ?? 'magnify'} size={19} color={colors.ink} />}</View>}<View style={styles.resultText}><Text numberOfLines={2} style={styles.resultTitle}>{item.title}</Text><Text numberOfLines={1} style={styles.resultDetail}>{item.detail}</Text></View><MaterialCommunityIcons name="chevron-right" size={17} color={colors.subtle} /></Pressable>;
}

function scopeToFilter(scope?: string): 'all' | ResultType {
  if (scope === 'posts') return 'post';
  if (scope === 'messages') return 'message';
  if (scope === 'orders' || scope === 'history') return 'order';
  return 'all';
}

const styles = StyleSheet.create({
  header: { minHeight: 58, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 4, borderBottomWidth: 1, borderBottomColor: colors.border },
  inputWrap: { flex: 1, height: 42, paddingLeft: spacing.md, flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, backgroundColor: colors.surface },
  input: { flex: 1, height: '100%', paddingHorizontal: spacing.sm, color: colors.ink, fontFamily: typography.regular, fontSize: 16 },
  filters: { height: 51, borderBottomWidth: 1, borderBottomColor: colors.border },
  filterContent: { paddingHorizontal: spacing.lg, alignItems: 'center', gap: spacing.sm },
  filter: { height: 31, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.surface },
  filterActive: { backgroundColor: colors.yellow },
  filterText: { color: colors.muted, fontSize: 14 },
  filterTextActive: { color: colors.ink, fontWeight: '700' },
  discovery: { padding: spacing.lg },
  sectionTitle: { marginTop: spacing.md, marginBottom: spacing.md, color: colors.ink, fontFamily: typography.rounded, fontSize: 16, fontWeight: '700' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tag: { minHeight: 34, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill },
  tagText: { color: colors.brown, fontSize: 14 },
  quickRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  quickText: { flex: 1 },
  quickTitle: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  quickDetail: { marginTop: 3, color: colors.muted, fontSize: 13 },
  results: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  emptyResults: { flexGrow: 1 },
  resultCount: { paddingVertical: spacing.md, color: colors.muted, fontSize: 13 },
  resultRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  resultIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: colors.surface },
  resultEmoji: { fontSize: 19 },
  resultText: { flex: 1 },
  resultTitle: { color: colors.ink, fontFamily: typography.regular, fontSize: 15, fontWeight: '600', lineHeight: 21 },
  resultDetail: { marginTop: 4, color: colors.muted, fontSize: 13 },
  pressed: { opacity: 0.62 },
});
