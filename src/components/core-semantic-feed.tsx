import { useEffect, useRef, useState, type ReactElement } from 'react';
import { FlatList, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { AppText as Text, AppTextInput as TextInput } from '@/components/app-text';
import { PrimaryButton } from '@/components/primitives';
import { coreError, type CorePost } from '@/lib/core-api';
import { engagementApi, useAccountPreferences, type SemanticFeedPage } from '@/lib/engagement-api';
import { useCoreScreenFocused } from '@/lib/core-hooks';
import { useAuthStore } from '@/store/auth-store';

// Keep the semantic order only for unchanged posts the server STILL authorizes.
export function validatedSemanticPosts(snapshot: CorePost[], fresh: CorePost[]): CorePost[] {
  const allowed = new Map(fresh.map((post) => [post.id, post]));
  return snapshot.flatMap((post) => {
    const current = allowed.get(post.id);
    return current && current.version === post.version && current.content === post.content &&
      JSON.stringify(current.tags) === JSON.stringify(post.tags) &&
      JSON.stringify(current.location) === JSON.stringify(post.location) &&
      current.deadline_at === post.deadline_at && current.price_per_person === post.price_per_person &&
      current.status === 'open' && current.joined < current.capacity
      ? [{ ...current, semantic_recommendation: post.semantic_recommendation }]
      : [];
  });
}

export function CoreSemanticFeed({ renderPost }: { renderPost: (post: CorePost) => ReactElement }) {
  const actor = useAuthStore((s) => s.user?.id);
  const focused = useCoreScreenFocused();
  const preferences = useAccountPreferences();
  const version = preferences.data?.version;
  const [text, setText] = useState('');
  return <SemanticFeedSession key={`${actor}:${focused}:${version}`} {...{
    actor, focused, version, text, setText, renderPost,
    preferenceError: preferences.error ? coreError(preferences.error) : '',
  }} />;
}

function SemanticFeedSession({ actor, focused, version, text, setText, renderPost, preferenceError }: {
  actor?: string; focused: boolean; version?: number; text: string;
  setText: (value: string) => void; renderPost: (post: CorePost) => ReactElement; preferenceError: string;
}) {
  const generation = useRef(0);
  const mounted = useRef(false);
  const [result, setResult] = useState<SemanticFeedPage>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState('');
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const validation = useQuery({
    queryKey: ['core', actor, 'semantic-feed-validation', version, result],
    queryFn: () => engagementApi.validateSemanticRecommendations(
      result!.items.map((p) => p.id), result!.preference_version,
    ),
    enabled: focused && !!actor && !!result?.items.length,
    refetchInterval: focused ? 10_000 : false,
    retry: false,
    gcTime: 0,
  });
  const posts = focused && !validation.error && validation.data && result
    ? validatedSemanticPosts(result.items, validation.data.items) : [];
  const run = async () => {
    const query = text.trim();
    const request = ++generation.current;
    setBusy(true);
    setError('');
    setResult(undefined);
    try {
      const response = await engagementApi.semanticRecommendations(query);
      if (!mounted.current || request !== generation.current || !focused ||
          useAuthStore.getState().user?.id !== actor) return;
      setSubmitted(query);
      setResult(response);
    } catch (e) {
      if (mounted.current && request === generation.current) setError(coreError(e));
    } finally {
      if (mounted.current && request === generation.current) setBusy(false);
    }
  };
  return <FlatList
    data={posts}
    keyExtractor={(post) => post.id}
    renderItem={({ item }) => renderPost(item)}
    keyboardShouldPersistTaps="handled"
    ListHeaderComponent={<View style={{ padding: 16, gap: 10 }}>
      <Text>說說現在想找什麼，讓 AI 比較貼文意思，例如「想找晚餐」。</Text>
      <TextInput
        accessibilityLabel="首頁語義推薦需求"
        placeholder="想找晚餐，也可以是活動剩餘便當"
        value={text}
        onChangeText={setText}
        maxLength={160}
        editable={!busy}
        style={{ borderWidth: 1, borderColor: '#b8b8b8', borderRadius: 8, padding: 12 }}
      />
      <PrimaryButton disabled={busy || !focused || !actor || version === undefined || !text.trim()} onPress={() => { void run(); }}>
        {busy ? 'AI 正在比較貼文…' : '用 AI 找相關拼單'}
      </PrimaryButton>
      <Text>保留地點偏好、截止時間與名額規則；不自動申請加入。模型只在按鈕操作時執行。</Text>
      {error ? <Text accessibilityRole="alert">{error} 可重試，或切回「依我的偏好」。</Text> : null}
      {preferenceError ? <Text accessibilityRole="alert">{preferenceError}</Text> : null}
      {result ? <Text>
        {result.status === 'completed' ? `已依「${submitted}」的語義與原有規則排序。` :
          result.status === 'unavailable' ? 'AI 暫不可用，以下保留原本規則排序，沒有語義分析結果。' : '目前沒有可加入的候選貼文。'}
        {`本次候選 ${result.candidate_count} 筆，最多 ${result.pool_limit} 筆。`}
        {result.truncated ? '尚有其他貼文未納入此次比較。' : ''}
      </Text> : null}
      {validation.error ? <>
        <Text accessibilityRole="alert">名額與權限更新失敗，暫停顯示舊結果。{coreError(validation.error)} 若偏好已變更，請重新執行 AI 推薦。</Text>
        <PrimaryButton secondary onPress={() => { void validation.refetch(); }}>重新檢查結果</PrimaryButton>
      </> : null}
    </View>}
    ListEmptyComponent={<View style={{ padding: 16 }}><Text>
      {busy ? '正在分析，請稍候。' : validation.isFetching ? '正在檢查最新名額與權限…' :
        result ? '目前沒有仍可顯示的結果，可重新比較或切回其他推薦。' : '輸入需求並按按鈕開始，原本的拼單功能仍可使用。'}
    </Text></View>}
  />;
}
