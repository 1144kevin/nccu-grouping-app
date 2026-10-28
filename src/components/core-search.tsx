import { FeedPostCard } from '@/components/feed-post-card';
import { useState } from 'react';
import { FlatList, StyleSheet, Switch, View } from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '@/components/app-text';
import { DetailHeader, EmptyState, PrimaryButton, Screen } from '@/components/primitives';
import { CORE_SUPABASE_MODE, coreError, toFeedPost } from '@/lib/core-api';
import { CloudSearchScreen } from '@/components/cloud-search';
import { useCorePosts } from '@/lib/core-hooks';
import { colors, radius, spacing } from '@/theme/tokens';

export function CoreSearchScreen({
  initialQuery = '',
  initialScope,
}: {
  initialQuery?: string;
  initialScope?: string;
}) {
  return CORE_SUPABASE_MODE ? (
    <CloudSearchScreen initialQuery={initialQuery} initialScope={initialScope} />
  ) : (
    <LocalPostSearch initialQuery={initialQuery} />
  );
}

function LocalPostSearch({ initialQuery = '' }: { initialQuery?: string }) {
  const [input, setInput] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [activeOnly, setActiveOnly] = useState(false);
  const result = useCorePosts('feed', query, activeOnly);
  return (
    <Screen>
      <DetailHeader title="搜尋拼單" />
      <View style={styles.searchRow}>
        <TextInput
          accessibilityLabel="搜尋拼單"
          placeholder="內容、標籤或主揪名稱"
          value={input}
          onChangeText={setInput}
          maxLength={100}
          returnKeyType="search"
          onSubmitEditing={() => setQuery(input.trim())}
          style={styles.input}
        />
        <PrimaryButton onPress={() => setQuery(input.trim())}>搜尋</PrimaryButton>
      </View>
      <View style={styles.searchRow}>
        <Text style={styles.hint}>未截止的拼單</Text>
        <Switch
          accessibilityLabel="只顯示未截止拼單"
          value={activeOnly}
          onValueChange={setActiveOnly}
        />
      </View>
      {result.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {coreError(result.error)}
        </Text>
      ) : null}
      <FlatList
        data={result.posts}
        keyExtractor={(post) => post.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            loading={result.isPending}
            icon="magnify-close"
            title={result.isPending ? '搜尋中' : result.error ? '搜尋失敗' : '沒有符合的拼單'}
            action={
              result.error ? (
                <PrimaryButton
                  secondary
                  onPress={() => {
                    void result.refetch();
                  }}
                >
                  重試
                </PrimaryButton>
              ) : undefined
            }
          />
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
        ItemSeparatorComponent={() => <View style={styles.divider} />}
        renderItem={({ item }) => <FeedPostCard post={toFeedPost(item)} corePost={item} />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchRow: { padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
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
  list: { paddingBottom: 120 },
  divider: { height: 1, backgroundColor: colors.border },
  card: {
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  title: { color: colors.ink, fontSize: 16, lineHeight: 24, fontWeight: '700' },
  hint: { flexShrink: 1, color: colors.muted, fontSize: 13, lineHeight: 20 },
  error: { padding: spacing.md, color: colors.danger, fontSize: 13 },
});
