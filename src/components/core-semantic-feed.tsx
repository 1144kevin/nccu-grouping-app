import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { FlatList, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { AppText as Text, AppTextInput as TextInput } from '@/components/app-text';
import { EmptyState, PrimaryButton } from '@/components/primitives';
import { colors, radius } from '@/theme/tokens';
import { coreError, type CorePost } from '@/lib/core-api';
import { engagementApi, useAccountPreferences, type SemanticFeedPage } from '@/lib/engagement-api';
import { useCoreScreenFocused } from '@/lib/core-hooks';
import { useAuthStore } from '@/store/auth-store';

// Keep the semantic order only for unchanged posts the server STILL authorizes.
export function validatedSemanticPosts(snapshot: CorePost[], fresh: CorePost[]): CorePost[] {
  const allowed = new Map(fresh.map((post) => [post.id, post]));
  return snapshot.flatMap((post) => {
    const current = allowed.get(post.id);
    return current &&
      current.version === post.version &&
      current.content === post.content &&
      JSON.stringify(current.tags) === JSON.stringify(post.tags) &&
      JSON.stringify(current.location) === JSON.stringify(post.location) &&
      current.deadline_at === post.deadline_at &&
      current.price_per_person === post.price_per_person &&
      current.status === 'open' &&
      current.joined < current.capacity
      ? [{ ...current, semantic_recommendation: post.semantic_recommendation }]
      : [];
  });
}

export function CoreSemanticFeed({
  renderPost,
  initialQuery = '',
  search,
}: {
  renderPost: (post: CorePost) => ReactElement;
  initialQuery?: string;
  search?: { query: string; revision: number };
}) {
  const actor = useAuthStore((s) => s.user?.id);
  const focused = useCoreScreenFocused();
  const preferences = useAccountPreferences();
  const version = preferences.data?.version;
  const [text, setText] = useState(initialQuery);
  return (
    <SemanticFeedSession
      key={`${actor}:${focused}:${version}`}
      {...{
        actor,
        focused,
        version,
        text: search?.query ?? text,
        setText,
        search,
        renderPost,
        preferenceError: preferences.error ? coreError(preferences.error) : '',
      }}
    />
  );
}

function SemanticFeedSession({
  actor,
  focused,
  version,
  text,
  setText,
  renderPost,
  preferenceError,
  search,
}: {
  actor?: string;
  focused: boolean;
  version?: number;
  text: string;
  setText: (value: string) => void;
  renderPost: (post: CorePost) => ReactElement;
  preferenceError: string;
  search?: { query: string; revision: number };
}) {
  const generation = useRef(0);
  const mounted = useRef(false);
  const [result, setResult] = useState<SemanticFeedPage>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState('');
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const validation = useQuery({
    queryKey: ['core', actor, 'semantic-feed-validation', version, result],
    queryFn: () =>
      engagementApi.validateSemanticRecommendations(
        result!.items.map((p) => p.id),
        result!.preference_version,
      ),
    enabled: focused && !!actor && !!result?.items.length,
    refetchInterval: focused ? 10_000 : false,
    retry: false,
    gcTime: 0,
  });
  const posts =
    focused && !validation.error && validation.data && result
      ? validatedSemanticPosts(result.items, validation.data.items)
      : [];
  const run = useCallback(async () => {
    if (!focused || !actor || version === undefined || !text.trim()) return;
    const query = text.trim();
    const request = ++generation.current;
    setBusy(true);
    setError('');
    setResult(undefined);
    try {
      const response = await engagementApi.semanticRecommendations(query);
      if (
        !mounted.current ||
        request !== generation.current ||
        !focused ||
        useAuthStore.getState().user?.id !== actor
      )
        return;
      setSubmitted(query);
      setResult(response);
    } catch (e) {
      if (mounted.current && request === generation.current) setError(coreError(e));
    } finally {
      if (mounted.current && request === generation.current) setBusy(false);
    }
  }, [text, focused, actor, version]);
  const lastTrigger = useRef(0);
  useEffect(() => {
    if (
      !search?.revision ||
      lastTrigger.current === search.revision ||
      !focused ||
      !actor ||
      version === undefined
    )
      return;
    lastTrigger.current = search.revision;
    void run();
  }, [search?.revision, focused, actor, version, run]);
  return (
    <FlatList
      data={posts}
      keyExtractor={(post) => post.id}
      renderItem={({ item }) => renderPost(item)}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={{ padding: 16, gap: 10 }}>
          {!search ? (
            <>
              <TextInput
                accessibilityLabel="語義搜尋需求"
                placeholder="想找晚餐，也可以是活動剩餘便當"
                value={text}
                onChangeText={setText}
                maxLength={160}
                editable={!busy}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  color: colors.ink,
                  borderRadius: radius.md,
                  padding: 12,
                  fontSize: 16,
                }}
              />
              <PrimaryButton
                loading={busy}
                disabled={busy || !focused || !actor || version === undefined || !text.trim()}
                onPress={() => {
                  void run();
                }}
              >
                {busy ? 'AI 正在比較貼文…' : '用 AI 找相關拼單'}
              </PrimaryButton>
            </>
          ) : null}
          {error ? <Text accessibilityRole="alert">{error} 請稍後再試。</Text> : null}
          {preferenceError ? <Text accessibilityRole="alert">{preferenceError}</Text> : null}
          {result ? (
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {result.status === 'completed'
                ? `「${submitted}」的相關拼單`
                : result.status === 'unavailable'
                  ? 'AI 暫時無法使用，先顯示推薦拼單。'
                  : '目前沒有可加入的候選貼文。'}
              {` · 比較 ${result.candidate_count} 筆`}
              {result.truncated ? '（部分候選）' : ''}
            </Text>
          ) : null}
          {validation.error ? (
            <>
              <Text accessibilityRole="alert">
                結果更新失敗。{coreError(validation.error)} 請重新搜尋。
              </Text>
              <PrimaryButton
                secondary
                onPress={() => {
                  void validation.refetch();
                }}
              >
                重新檢查結果
              </PrimaryButton>
            </>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        <EmptyState
          icon="text-box-search-outline"
          title={
            busy
              ? '正在尋找相關拼單…'
              : validation.isFetching
                ? '更新結果中…'
                : result
                  ? '目前沒有可加入的相關拼單'
                  : '今天想找什麼？'
          }
        />
      }
    />
  );
}
