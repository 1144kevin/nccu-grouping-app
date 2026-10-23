import { useEffect, useRef, useState } from 'react';
import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText as Text, AppTextInput as TextInput } from '@/components/app-text';
import { Avatar, DetailHeader, IconButton, PrimaryButton, Screen } from '@/components/primitives';
import { KeyboardViewport } from '@/components/keyboard-layout';
import { coreError, newRequestKey } from '@/lib/core-api';
import { useCoreScreenFocused, invalidateCore } from '@/lib/core-hooks';
import { socialApi } from '@/lib/social-api';
import { useAuthStore } from '@/store/auth-store';
import { colors, radius } from '@/theme/tokens';

export function DirectChat({ id }: { id: string }) {
  const actor = useAuthStore((s) => s.user?.id);
  return <Chat key={`${actor}:${id}`} id={id} actor={actor} />;
}
function Chat({ id, actor }: { id: string; actor?: string }) {
  const focused = useCoreScreenFocused();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const draft = useRef<{ content: string; key: string } | null>(null);
  const read = useRef<string | undefined>(undefined);
  const query = useInfiniteQuery({
    queryKey: ['core', actor, 'direct-chat', id],
    queryFn: ({ pageParam }) => socialApi.messages(id, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.next_cursor ?? undefined,
    enabled: !!actor && focused && !!id,
    refetchInterval: focused ? 5000 : false,
    retry: false,
    gcTime: 0,
  });
  const page = query.error ? undefined : query.data?.pages[0];
  const messages = [
    ...new Map((query.data?.pages.flatMap((p) => p.messages) ?? []).map((m) => [m.id, m])).values(),
  ];
  const latest = page?.messages[0]?.id;
  useEffect(() => {
    if (!focused || !actor || !latest || read.current === latest) return;
    read.current = latest;
    void socialApi
      .read(id, latest)
      .then(() => {
        if (useAuthStore.getState().user?.id === actor) void invalidateCore();
      })
      .catch(() => {
        read.current = undefined;
      });
  }, [focused, actor, latest, id, query.dataUpdatedAt]);
  const send = useMutation({
    retry: false,
    mutationFn: () => {
      const content = text.trim();
      if (draft.current?.content !== content) draft.current = { content, key: newRequestKey() };
      return socialApi.send(id, content, draft.current.key);
    },
    onSuccess: () => {
      if (useAuthStore.getState().user?.id !== actor) return;
      setText('');
      draft.current = null;
      void query.refetch();
      void invalidateCore();
    },
  });
  return (
    <Screen>
      <DetailHeader
        title={page ? `【私訊】${page.thread.post.content.split('\n')[0]}` : '私訊'}
        right={
          page ? (
            <IconButton
              icon="text-box-outline"
              label="查看貼文"
              onPress={() => router.push(`/post/${page.thread.post.id}`)}
            />
          ) : undefined
        }
      />
      <KeyboardViewport>
        {page ? (
          <View style={styles.peer}>
            <Avatar name={page.thread.peer_name} badge={page.thread.peer_badge} size={34} />
            <Text style={styles.peerName}>{page.thread.peer_name}</Text>
          </View>
        ) : null}
        {query.error ? (
          <View>
            <Text accessibilityRole="alert" style={styles.error}>
              {coreError(query.error)}
            </Text>
            <PrimaryButton
              secondary
              onPress={() => {
                void query.refetch();
              }}
            >
              重試
            </PrimaryButton>
          </View>
        ) : null}
        {query.isPending ? (
          <ActivityIndicator />
        ) : (
          <FlatList
            inverted
            data={query.error ? [] : messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.messages}
            keyboardShouldPersistTaps="handled"
            ListFooterComponent={
              query.hasNextPage ? (
                <PrimaryButton
                  secondary
                  disabled={query.isFetchingNextPage}
                  onPress={() => {
                    void query.fetchNextPage();
                  }}
                >
                  較早訊息
                </PrimaryButton>
              ) : null
            }
            renderItem={({ item }) => (
              <View style={[styles.message, item.sender_id === actor && styles.mine]}>
                <Text style={styles.sender}>{item.sender_name}</Text>
                <View style={[styles.bubble, item.sender_id === actor && styles.mineBubble]}>
                  <Text style={styles.body}>{item.content}</Text>
                </View>
                <Text style={styles.time}>
                  {new Date(item.created_at).toLocaleTimeString('zh-TW', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            )}
          />
        )}
        {send.error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {coreError(send.error)} 文字已保留，可重試。
          </Text>
        ) : null}
        {page?.can_send ? (
          <View style={[styles.composer, { paddingBottom: Math.max(8, insets.bottom) }]}>
            <TextInput
              accessibilityLabel="私訊內容"
              placeholder="傳送訊息…"
              multiline
              maxLength={2000}
              editable={!send.isPending}
              value={text}
              onChangeText={setText}
              style={styles.input}
            />
            <PrimaryButton disabled={!text.trim() || send.isPending} onPress={() => send.mutate()}>
              {send.isPending ? '傳送中…' : '傳送'}
            </PrimaryButton>
          </View>
        ) : null}
      </KeyboardViewport>
    </Screen>
  );
}
const styles = StyleSheet.create({
  peer: {
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  peerName: { color: colors.ink, fontSize: 14 },
  messages: { padding: 16 },
  message: { alignItems: 'flex-start', marginBottom: 16, gap: 4 },
  mine: { alignItems: 'flex-end' },
  sender: { fontSize: 12, color: colors.muted },
  bubble: {
    maxWidth: '85%',
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  mineBubble: { backgroundColor: colors.yellow },
  body: { color: colors.ink, fontSize: 16, lineHeight: 23 },
  time: { color: colors.muted, fontSize: 11 },
  error: { padding: 10, color: colors.danger },
  composer: {
    padding: 8,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 10,
    color: colors.ink,
    fontSize: 16,
  },
});
