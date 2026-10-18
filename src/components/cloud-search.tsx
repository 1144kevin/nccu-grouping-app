import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Switch, View } from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '@/components/app-text';
import { DetailHeader, EmptyState, PrimaryButton, Screen } from '@/components/primitives';
import { coreApi, coreError, type CoreSearchItem } from '@/lib/core-api';
import { useCorePosts, useCoreScreenFocused } from '@/lib/core-hooks';
import { useAuthStore } from '@/store/auth-store';
import { colors, radius, spacing } from '@/theme/tokens';

type Scope = 'posts' | 'users' | 'messages' | 'history';
const scopes: [Scope, string][] = [
  ['posts', '貼文'],
  ['users', '使用者'],
  ['messages', '我的訊息'],
  ['history', '我的紀錄'],
];
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
    initialScope === 'messages'
      ? 'messages'
      : initialScope === 'users'
        ? 'users'
        : initialScope === 'history' || initialScope === 'orders'
          ? 'history'
          : 'posts',
  );
  const [activeOnly, setActiveOnly] = useState(false);
  return (
    <Screen>
      <DetailHeader title="搜尋" />
      <View style={styles.row}>
        <TextInput
          accessibilityLabel="搜尋內容"
          placeholder="貼文、公開資料或自己的聊天室訊息"
          value={input}
          onChangeText={setInput}
          maxLength={80}
          returnKeyType="search"
          onSubmitEditing={() => setQuery(input.trim())}
          style={styles.input}
        />
        <PrimaryButton onPress={() => setQuery(input.trim())}>搜尋</PrimaryButton>
      </View>
      <View style={styles.tabs}>
        {scopes.map(([key, label]) => (
          <PrimaryButton key={key} secondary={scope !== key} onPress={() => setScope(key)}>
            {label}
          </PrimaryButton>
        ))}
      </View>
      {scope === 'posts' ? (
        <>
          <View style={styles.row}>
            <Text style={styles.hint}>只顯示尚未截止且未取消的拼單</Text>
            <Switch
              accessibilityLabel="只顯示未截止拼單"
              value={activeOnly}
              onValueChange={setActiveOnly}
            />
          </View>
          <PostResults query={query} activeOnly={activeOnly} />
        </>
      ) : (
        <PrivateResults key={scope} scope={scope} query={query} />
      )}
    </Screen>
  );
}

function PostResults({ query, activeOnly }: { query: string; activeOnly: boolean }) {
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
        data={result.posts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          result.isPending ? (
            <ActivityIndicator />
          ) : (
            <EmptyState icon="magnify-close" title={result.error ? '搜尋失敗' : '沒有符合的拼單'} />
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
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            style={styles.card}
            onPress={() => router.push(`/post/${item.id}`)}
          >
            <Text style={styles.title}>{item.content}</Text>
            <Text style={styles.hint}>
              {item.author_name} · {item.joined}/{item.capacity}人
            </Text>
            <Text style={styles.hint}>{item.tags.map((tag) => `#${tag}`).join('　')}</Text>
            <Text style={styles.hint}>
              截止：{new Date(item.deadline_at).toLocaleString('zh-TW')}
            </Text>
          </Pressable>
        )}
      />
    </>
  );
}
function PrivateResults({ scope, query }: { scope: Exclude<Scope, 'posts'>; query: string }) {
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
  if (!valid)
    return (
      <Text style={styles.note}>
        請輸入2～80字並按搜尋。使用者只查公開名稱與介紹；訊息只查目前可進入的聊天室；紀錄只查自己相關且已結束的拼單。
      </Text>
    );
  return (
    <>
      <Text style={styles.note}>
        {scope === 'users'
          ? '只搜尋公開名稱與介紹，不搜尋信箱。'
          : scope === 'messages'
            ? '只包含目前仍有權進入的聊天室；不會因搜尋而標成已讀。'
            : '只包含你曾申請或主揪、已截止或已取消的拼單。'}
      </Text>
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
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          result.isPending ? (
            <ActivityIndicator />
          ) : (
            <EmptyState
              icon="magnify-close"
              title={result.error ? '搜尋失敗' : '沒有符合且可查看的結果'}
            />
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
      style={styles.card}
      onPress={open}
    >
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.body}>{item.detail}</Text>
      <Text style={styles.hint}>{new Date(item.created_at).toLocaleString('zh-TW')}</Text>
    </Pressable>
  );
}
function ErrorAndRetry({ error, retry }: { error: unknown; retry: () => void }) {
  return error ? (
    <View style={styles.note}>
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
  row: { padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tabs: { padding: spacing.sm, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.ink,
  },
  list: { padding: spacing.md, paddingBottom: 100 },
  card: {
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  title: { color: colors.ink, fontSize: 16, lineHeight: 24, fontWeight: '700' },
  body: { color: colors.ink, fontSize: 14, lineHeight: 21 },
  hint: { flexShrink: 1, color: colors.muted, fontSize: 13, lineHeight: 20 },
  note: { padding: spacing.md },
  error: { color: colors.danger },
});
