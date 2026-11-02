import { PageLoading } from '@/components/page-loading';
import { InlineLoading } from '@/components/inline-loading';
import { ReputationBadge } from '@/components/reputation-badge';
import { ChatComposer, ChatPhoto } from '@/components/chat-composer';
import { useEffect, useRef, useState } from 'react';
import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/app-text';
import { ChatTextInput as TextInput } from '@/components/chat-text-input';
import { Avatar, DetailHeader, IconButton, PrimaryButton, Screen } from '@/components/primitives';
import { KeyboardViewport } from '@/components/keyboard-layout';
import { coreError, newRequestKey } from '@/lib/core-api';
import { useCoreScreenFocused, invalidateCore } from '@/lib/core-hooks';
import { socialApi } from '@/lib/social-api';
import { useChatOutbox } from '@/lib/chat-outbox';
import type { ThreadMessage } from '@/lib/social-api';
import { useAuthStore } from '@/store/auth-store';
import { colors, radius } from '@/theme/tokens';
import { ChatSendButton } from './chat-controls';
import { useChatDateIndicator } from './chat-date-indicator';
import { displayTime } from '@/lib/display-time';

export function DirectChat({ id }: { id: string }) {
  const actor = useAuthStore((s) => s.user?.id);
  return <Chat key={`${actor}:${id}`} id={id} actor={actor} />;
}
function Chat({ id, actor }: { id: string; actor?: string }) {
  const dates = useChatDateIndicator();
  const focused = useCoreScreenFocused();
  const [text, setText] = useState('');
  const draft = useRef<{ content: string; key: string } | null>(null);
  const read = useRef<string | undefined>(undefined);
  const query = useInfiniteQuery({
    queryKey: ['core', actor, 'direct-chat', id],
    queryFn: ({ pageParam }) => socialApi.messages(id, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.next_cursor ?? undefined,
    enabled: !!actor && focused && !!id,
    refetchInterval: focused ? 2000 : false,
    retry: false,
    gcTime: 0,
  });
  const page = query.error ? undefined : query.data?.pages[0];
  const serverMessages = [
    ...new Map((query.data?.pages.flatMap((p) => p.messages) ?? []).map((m) => [m.id, m])).values(),
  ];
  const outbox = useChatOutbox<ThreadMessage>(serverMessages);
  const messages = outbox.items;
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
  function pendingDraft() {
    const content = text.trim();
    if (draft.current?.content !== content) draft.current = { content, key: newRequestKey() };
    return draft.current;
  }
  const ownMessage = (content: string, id: string) => ({
    id,
    sender_id: actor ?? '',
    sender_name: useAuthStore.getState().user?.display_name ?? '你',
    sender_badge: useAuthStore.getState().user?.badge ?? '🍱',
    content,
    created_at: new Date().toISOString(),
  });
  const send = useMutation({
    retry: false,
    mutationFn: () => {
      const pending = pendingDraft();
      return socialApi.send(id, pending.content, pending.key);
    },
    onMutate: () => {
      const pending = pendingDraft();
      outbox.begin(pending.key, ownMessage(pending.content, `local:${pending.key}`));
    },
    onSuccess: (message) => {
      if (useAuthStore.getState().user?.id !== actor) return;
      if (draft.current) outbox.confirm(draft.current.key, message);
      setText('');
      draft.current = null;
      void query.refetch();
    },
    onError: () => {
      if (draft.current) outbox.fail(draft.current.key);
    },
  });
  return (
    <Screen>
      <DetailHeader
        title={page?.thread.peer_name ?? '私訊'}
        right={
          page ? (
            <IconButton
              icon="file-document-outline"
              label="查看拼單詳情"
              onPress={() => router.push(`/order/${page.thread.post.id}`)}
            />
          ) : undefined
        }
      />
      <KeyboardViewport>
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
          <PageLoading />
        ) : (
          <View style={{ flex: 1 }}>
            <FlatList
              onViewableItemsChanged={dates.onViewableItemsChanged}
              onScroll={dates.onScroll}
              scrollEventThrottle={100}
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
                  {item.sender_id !== actor ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Avatar name={item.sender_name} badge={item.sender_badge} size={26} />
                      <Text style={styles.sender}>{item.sender_name}</Text>
                      <ReputationBadge level={item.sender_level} />
                    </View>
                  ) : null}
                  <View
                    style={[
                      styles.bubble,
                      item.sender_id === actor && styles.mineBubble,
                      item.image_id && styles.photoBubble,
                    ]}
                  >
                    {item.image_id ? (
                      <ChatPhoto imageId={item.image_id} localUri={item.local_image_uri} />
                    ) : (
                      <Text style={styles.body}>{item.content}</Text>
                    )}
                  </View>
                  {item.delivery ? (
                    item.delivery === 'sending' ? (
                      <InlineLoading label="傳送中" textStyle={styles.time} />
                    ) : (
                      <Text style={styles.time}>尚未送出，請重試</Text>
                    )
                  ) : null}
                  <Text style={styles.time}>{displayTime(item.created_at)}</Text>
                </View>
              )}
            />
            {dates.indicator}
          </View>
        )}
        {send.error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {coreError(send.error)} 文字已保留，可重試。
          </Text>
        ) : null}
        {page?.can_send ? (
          <ChatComposer
            kind="direct"
            threadId={id}
            disabled={send.isPending}
            onSent={(photo) => {
              outbox.begin(photo.id, {
                ...ownMessage('📷 照片', photo.id),
                image_id: photo.image_id,
                local_image_uri: photo.local_uri,
              });
              outbox.confirm(photo.id, { id: photo.id });
              void query.refetch();
            }}
          >
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
            <ChatSendButton
              disabled={!text.trim() || send.isPending}
              onPress={() => send.mutate()}
              loading={send.isPending}
            />
          </ChatComposer>
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
  messages: { paddingHorizontal: 8, paddingVertical: 16, flexGrow: 1 },
  message: { alignItems: 'flex-start', marginBottom: 16, gap: 4 },
  mine: { alignItems: 'flex-end' },
  sender: { fontSize: 12, color: colors.muted },
  bubble: {
    maxWidth: '85%',
    padding: 12,
    borderRadius: 22,
    backgroundColor: colors.surface,
  },
  mineBubble: { backgroundColor: colors.yellow },
  photoBubble: { backgroundColor: 'transparent', padding: 0, borderRadius: 0 },
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
