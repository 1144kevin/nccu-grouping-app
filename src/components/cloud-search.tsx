import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '@/components/app-text';
import { Avatar, EmptyState, IconButton, PrimaryButton, Screen } from '@/components/primitives';
import { CorePostRow, shortDate } from '@/components/list-ui';
import { CoreSemanticFeed } from '@/components/core-semantic-feed';
import { coreApi, coreError, type CoreSearchItem } from '@/lib/core-api';
import { useCorePosts, useCoreScreenFocused } from '@/lib/core-hooks';
import { useAuthStore } from '@/store/auth-store';
import { colors, radius, spacing, typography } from '@/theme/tokens';

type Scope = 'all' | 'posts' | 'semantic' | 'users' | 'messages' | 'history';
const scopes: [Scope, string][] = [
  ['all', '全部'],
  ['posts', '拼單'],
  ['semantic', 'AI 找拼單'],
  ['users', '使用者'],
  ['messages', '訊息'],
  ['history', '紀錄'],
];
const popularTags = ['晚餐', '飲料', '便當', '披薩', '宵夜'];
export function CloudSearchScreen({
  initialQuery = '',
  initialScope,
}: {
  initialQuery?: string;
  initialScope?: string;
}) {
  const [input, setInput] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery.trim());
  const [scope, setScope] = useState<Scope>(
    initialScope === 'orders'
      ? 'history'
      : scopes.some(([s]) => s === initialScope)
        ? (initialScope as Scope)
        : 'all',
  );
  const [activeOnly, setActiveOnly] = useState(false);
  const [revision, setRevision] = useState(0);
  const [quick, setQuick] = useState<'soon' | 'campus'>();
  const submit = () => {
    setQuick(undefined);
    setQuery(input.trim());
    if (scope === 'semantic') setRevision((r) => r + 1);
  };
  return (
    <Screen>
      <View style={styles.header}>
        <IconButton
          icon="chevron-left"
          label="返回"
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/');
          }}
        />
        <View style={styles.inputWrap}>
          <MaterialCommunityIcons name="magnify" size={19} color={colors.muted} />
          <TextInput
            accessibilityLabel="搜尋內容"
            placeholder="搜尋拼單、使用者或訊息"
            value={input}
            onChangeText={setInput}
            maxLength={80}
            returnKeyType="search"
            onSubmitEditing={submit}
            style={styles.input}
          />
          {input ? (
            <IconButton
              icon="close-circle"
              label="清除搜尋"
              onPress={() => {
                setInput('');
                setQuery('');
              }}
            />
          ) : null}
        </View>
        <IconButton icon="arrow-right" label="搜尋" onPress={submit} />
      </View>
      <View style={styles.filters}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
        >
          {scopes.map(([key, label]) => (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityState={{ selected: scope === key }}
              onPress={() => {
                setScope(key);
                setRevision(0);
                setQuick(undefined);
              }}
              style={[styles.filter, scope === key && styles.filterActive]}
            >
              <Text style={[styles.filterText, scope === key && styles.filterTextActive]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      {scope === 'semantic' ? (
        <CoreSemanticFeed
          search={{ query: input, revision }}
          renderPost={(post) => <CorePostRow post={post} />}
        />
      ) : scope === 'all' && query ? (
        <AllResults query={query} onScope={setScope} />
      ) : scope === 'posts' || scope === 'all' ? (
        <>
          {query ? (
            <View style={styles.toggle}>
              <Text style={styles.hint}>未截止的拼單</Text>
              <Switch
                accessibilityLabel="只顯示未截止拼單"
                value={activeOnly}
                onValueChange={setActiveOnly}
              />
            </View>
          ) : null}
          {query || quick ? (
            <PostResults query={query} activeOnly={activeOnly || !!quick} quick={quick} />
          ) : (
            <View style={styles.discovery}>
              <Text style={styles.sectionTitle}>熱門搜尋</Text>
              <View style={styles.tags}>
                {popularTags.map((tag) => (
                  <Pressable
                    key={tag}
                    onPress={() => {
                      setInput(tag);
                      setQuery(tag);
                    }}
                    style={styles.tag}
                  >
                    <MaterialCommunityIcons name="trending-up" size={14} color={colors.brown} />
                    <Text style={styles.tagText}>{tag}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.sectionTitle}>快速尋找</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setQuick('soon');
                  setScope('posts');
                  setQuery('');
                }}
                style={styles.quickRow}
              >
                <MaterialCommunityIcons name="clock-fast" size={22} color={colors.yellow} />
                <Text style={styles.quickLabel}>即將截止</Text>
                <MaterialCommunityIcons name="chevron-right" size={18} color={colors.muted} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setQuick('campus');
                  setScope('posts');
                  setQuery('');
                }}
                style={styles.quickRow}
              >
                <MaterialCommunityIcons name="map-marker-outline" size={22} color={colors.yellow} />
                <Text style={styles.quickLabel}>校園附近</Text>
                <MaterialCommunityIcons name="chevron-right" size={18} color={colors.muted} />
              </Pressable>
            </View>
          )}
        </>
      ) : (
        <PrivateResults key={scope} scope={scope} query={query} />
      )}
    </Screen>
  );
}
function AllResults({ query, onScope }: { query: string; onScope: (scope: Scope) => void }) {
  const actor = useAuthStore((s) => s.user?.id);
  const focused = useCoreScreenFocused();
  const result = useInfiniteQuery({
    queryKey: ['core', actor, 'search-all', query],
    queryFn: async ({ pageParam }) => {
      const scopes = ['users', 'messages', 'history'] as const;
      const responses = await Promise.allSettled([
        coreApi.posts('feed', pageParam, query),
        ...scopes.map((scope) => coreApi.search(scope, query)),
      ]);
      return responses;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: () => undefined,
    enabled: !!actor && focused && query.length >= 2,
    retry: false,
    gcTime: 0,
  });
  const responses = result.data?.pages[0];
  const postResult = responses?.[0];
  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 80 }}>
      {query.length < 2 ? (
        <EmptyState icon="magnify" title="輸入至少 2 個字開始搜尋" />
      ) : result.isPending ? (
        <ActivityIndicator />
      ) : null}
      {responses?.map((entry, index) => (
        <View key={index}>
          <Text style={[styles.sectionTitle, { paddingHorizontal: spacing.lg }]}>
            {['拼單', '使用者', '訊息', '紀錄'][index]}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => onScope((['posts', 'users', 'messages', 'history'] as Scope[])[index])}
          >
            <Text style={{ color: colors.brown, paddingHorizontal: spacing.lg, paddingBottom: 8 }}>
              查看全部
            </Text>
          </Pressable>
          {entry.status === 'rejected' ? (
            <Text style={styles.error}>{coreError(entry.reason)}</Text>
          ) : index === 0 ? (
            postResult?.status === 'fulfilled' ? (
              postResult.value.items.map((p) => (
                <CorePostRow key={p.id} post={p as import('@/lib/core-api').CorePost} />
              ))
            ) : null
          ) : (
            entry.value.items.map((item) => (
              <SearchResult key={item.id} item={item as CoreSearchItem} />
            ))
          )}
          {entry.status === 'fulfilled' && !entry.value.items.length ? (
            <Text style={{ color: colors.muted, paddingHorizontal: spacing.lg }}>
              沒有符合的結果
            </Text>
          ) : null}
        </View>
      ))}
      <ErrorAndRetry
        error={result.error}
        retry={() => {
          void result.refetch();
        }}
      />
    </ScrollView>
  );
}

function PostResults({
  query,
  activeOnly,
  quick,
}: {
  query: string;
  activeOnly: boolean;
  quick?: 'soon' | 'campus';
}) {
  const result = useCorePosts('feed', query, activeOnly);
  return (
    <>
      <ErrorAndRetry
        error={result.error}
        retry={() => {
          void result.refetch();
        }}
      />
      <FlatList
        keyboardShouldPersistTaps="handled"
        data={
          quick === 'soon'
            ? [...result.posts].sort(
                (a, b) => Date.parse(a.deadline_at) - Date.parse(b.deadline_at),
              )
            : quick === 'campus'
              ? result.posts.filter(
                  (p) =>
                    p.location &&
                    p.location.latitude >= 24.975 &&
                    p.location.latitude <= 24.998 &&
                    p.location.longitude >= 121.565 &&
                    p.location.longitude <= 121.59,
                )
              : result.posts
        }
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.results}
        ListEmptyComponent={
          result.isPending ? (
            <ActivityIndicator />
          ) : (
            <EmptyState icon="magnify-close" title="沒有符合的拼單" />
          )
        }
        ListFooterComponent={
          result.hasNextPage ? (
            <PrimaryButton
              secondary
              disabled={result.isFetchingNextPage}
              onPress={() => {
                void result.fetchNextPage();
              }}
            >
              載入更多
            </PrimaryButton>
          ) : null
        }
        renderItem={({ item }) => <CorePostRow post={item} />}
      />
    </>
  );
}
function PrivateResults({
  scope,
  query,
}: {
  scope: 'users' | 'messages' | 'history';
  query: string;
}) {
  const actor = useAuthStore((state) => state.user?.id);
  const focused = useCoreScreenFocused();
  const valid = query.length >= 2 && query.length <= 80;
  const result = useInfiniteQuery({
    queryKey: ['core', actor, 'search', scope, query],
    queryFn: ({ pageParam }) => coreApi.search(scope, query, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    enabled: !!actor && focused && valid,
    retry: false,
    gcTime: 0,
  });
  const items = result.data?.pages.flatMap((page) => page.items) ?? [];
  if (!valid) return <EmptyState icon="magnify" title="輸入至少 2 個字開始搜尋" />;
  return (
    <>
      <ErrorAndRetry
        error={result.error}
        retry={() => {
          void result.refetch();
        }}
      />
      <FlatList
        keyboardShouldPersistTaps="handled"
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.results}
        ListEmptyComponent={
          result.isPending ? (
            <ActivityIndicator />
          ) : (
            <EmptyState icon="magnify-close" title="沒有符合的結果" />
          )
        }
        ListFooterComponent={
          result.hasNextPage ? (
            <PrimaryButton
              secondary
              disabled={result.isFetchingNextPage}
              onPress={() => {
                void result.fetchNextPage();
              }}
            >
              載入更多
            </PrimaryButton>
          ) : null
        }
        renderItem={({ item }) => <SearchResult item={item} />}
      />
    </>
  );
}
function SearchResult({ item }: { item: CoreSearchItem }) {
  const open = () => {
    if (item.kind === 'user') router.push(`/user/${item.id}`);
    else if (item.post_id)
      router.push(item.kind === 'message' ? `/chat/${item.post_id}` : `/order/${item.post_id}`);
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`查看搜尋結果 ${item.title}`}
      onPress={open}
      style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}
    >
      {item.kind === 'user' || item.kind === 'message' ? (
        <Avatar name={item.title} badge="🍱" size={44} />
      ) : (
        <View style={styles.resultIcon}>
          <MaterialCommunityIcons name="clipboard-text-outline" size={22} color={colors.brown} />
        </View>
      )}
      <View style={styles.resultText}>
        <Text numberOfLines={1} style={styles.resultTitle}>
          {item.title}
        </Text>
        <Text numberOfLines={2} style={styles.resultDetail}>
          {item.detail}
        </Text>
        <Text style={styles.hint}>{shortDate(item.created_at)}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={17} color={colors.subtle} />
    </Pressable>
  );
}
function ErrorAndRetry({ error, retry }: { error: unknown; retry: () => void }) {
  return error ? (
    <View style={styles.discovery}>
      <Text accessibilityRole="alert" style={styles.error}>
        {coreError(error)}
      </Text>
      <PrimaryButton secondary onPress={retry}>
        重試搜尋
      </PrimaryButton>
    </View>
  ) : null;
}
const styles = StyleSheet.create({
  quickRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  quickLabel: { flex: 1, color: colors.ink, fontSize: 16 },
  header: {
    minHeight: 58,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  inputWrap: {
    flex: 1,
    height: 42,
    paddingLeft: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    height: '100%',
    paddingHorizontal: spacing.sm,
    color: colors.ink,
    fontFamily: typography.regular,
    fontSize: 16,
  },
  filters: { height: 51, borderBottomWidth: 1, borderBottomColor: colors.border },
  filterContent: { paddingHorizontal: spacing.lg, alignItems: 'center', gap: spacing.sm },
  filter: {
    height: 31,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  filterActive: { backgroundColor: colors.yellow },
  filterText: { color: colors.muted, fontSize: 14 },
  filterTextActive: { color: colors.ink, fontWeight: '700' },
  toggle: {
    paddingHorizontal: spacing.lg,
    minHeight: 42,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  results: { paddingBottom: 100 },
  discovery: { padding: spacing.lg },
  sectionTitle: {
    marginVertical: spacing.md,
    fontSize: 16,
    fontFamily: typography.rounded,
    fontWeight: '700',
    color: colors.ink,
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tag: {
    minHeight: 34,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
  },
  tagText: { color: colors.brown, fontSize: 14 },
  resultRow: {
    minHeight: 82,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  resultIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultText: { flex: 1, minWidth: 0 },
  resultTitle: { color: colors.ink, fontSize: 15, fontWeight: '600', lineHeight: 21 },
  resultDetail: { marginVertical: 4, color: colors.muted, fontSize: 13, lineHeight: 19 },
  hint: { color: colors.muted, fontSize: 12 },
  error: { color: colors.danger },
  pressed: { opacity: 0.62 },
});
