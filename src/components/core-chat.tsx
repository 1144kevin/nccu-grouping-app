import { PageLoading } from '@/components/page-loading';
import { InlineLoading } from '@/components/inline-loading';
import { ReputationBadge } from '@/components/reputation-badge';
import { ChatComposer, ChatPhoto } from '@/components/chat-composer';
import { useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { KeyboardViewport } from '@/components/keyboard-layout';
import { AppText as Text } from '@/components/app-text';
import { ChatTextInput as TextInput } from '@/components/chat-text-input';
import { Avatar, DetailHeader, IconButton, PrimaryButton, Screen } from '@/components/primitives';
import { coreApi, coreError, newRequestKey } from '@/lib/core-api';
import { useCoreScreenFocused } from '@/lib/core-hooks';
import { queryClient } from '@/lib/query-client';
import { useChatOutbox } from '@/lib/chat-outbox';
import type { CoreMessage } from '@/lib/core-api';
import { chatMessagesNewestFirst } from '@/lib/chat-message-pages';
import { useAuthStore } from '@/store/auth-store';
import { colors, radius, spacing } from '@/theme/tokens';
import { ChatSendButton } from './chat-controls';
import { useChatDateIndicator } from './chat-date-indicator';
import { displayTime } from '@/lib/display-time';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export { UnifiedInbox as CoreInbox } from '@/components/unified-inbox';

export function CoreGroupChat({ id }: { id: string }) {
  const actor = useAuthStore((state) => state.user?.id);
  return <GroupChat key={`${actor}:${id}`} id={id} />;
}

function GroupChat({ id }: { id: string }) {
  const dates = useChatDateIndicator();
  const user = useAuthStore((state) => state.user);
  const focused = useCoreScreenFocused();
  const [text, setText] = useState('');
  const draft = useRef<{ text: string; key: string } | null>(null);
  const readState = useRef<{ done: string | null; pending: string | null }>({
    done: null,
    pending: null,
  });
  const query = useInfiniteQuery({
    queryKey: ['core', user?.id, 'chat', id],
    queryFn: ({ pageParam }) => coreApi.messages(id, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    enabled: !!user && focused && !!id,
    refetchInterval: focused ? 2000 : false,
    retry: false,
    gcTime: 0,
  });
  const outbox = useChatOutbox<CoreMessage>(chatMessagesNewestFirst(query.data?.pages ?? []));
  const ownMessage = (content: string, messageId: string): CoreMessage => ({
    id: messageId,
    post_id: id,
    sender_id: user?.id ?? '',
    sender_name: user?.display_name ?? '你',
    sender_badge: user?.badge ?? '🍱',
    content,
    created_at: new Date().toISOString(),
  });
  const mutation = useMutation({
    mutationFn: (value: { text: string; key: string }) =>
      coreApi.sendMessage(id, value.text, value.key),
    onMutate: (value) => outbox.begin(value.key, ownMessage(value.text, `local:${value.key}`)),
    onSuccess: (message, value) => {
      outbox.confirm(value.key, message);
      setText('');
      draft.current = null;
    },
    onError: (_, value) => outbox.fail(value.key),
    onSettled: () => {
      void query.refetch();
    },
  });
  const current = query.data?.pages[0];
  const denied =
    isAxiosError(query.error) && [401, 403, 404].includes(query.error.response?.status ?? 0);
  const latestId = current?.messages.at(-1)?.id;
  useEffect(() => {
    if (
      !focused ||
      denied ||
      !latestId ||
      readState.current.done === latestId ||
      readState.current.pending
    )
      return;
    readState.current.pending = latestId;
    void coreApi
      .readChat(id, latestId)
      .then(() => {
        readState.current.done = latestId;
        void queryClient.invalidateQueries({ queryKey: ['core', user?.id, 'chat-activity'] });
      })
      .catch(() => {
        /* Retry on the next successful message refresh. */
      })
      .finally(() => {
        readState.current.pending = null;
      });
  }, [focused, denied, latestId, id, user?.id, query.dataUpdatedAt]);
  const messages = outbox.items;
  function send() {
    const value = text.trim();
    if (!value || !current?.can_send || mutation.isPending) return;
    if (draft.current?.text !== value) draft.current = { text: value, key: newRequestKey() };
    mutation.mutate(draft.current);
  }
  return (
    <Screen>
      <DetailHeader
        title={
          query.data?.pages[0]?.post
            ? `【群組】${query.data.pages[0].post.content.split('\n')[0]}`
            : '拼單聊天室'
        }
        right={
          <IconButton
            icon="file-document-outline"
            label="查看拼單詳情"
            onPress={() => router.push(`/order/${id}`)}
          />
        }
      />
      {!current || denied ? (
        <View style={styles.list}>
          {query.isPending ? (
            <PageLoading />
          ) : (
            <Text accessibilityRole="alert" style={styles.error}>
              {coreError(query.error)}
            </Text>
          )}
          {query.error && !denied ? (
            <PrimaryButton
              secondary
              onPress={() => {
                void query.refetch();
              }}
            >
              重試連線
            </PrimaryButton>
          ) : null}
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <KeyboardViewport>
            {current.post.is_demo ? (
              <Text style={styles.note}>
                示範聊天室：訊息會存入開發資料庫，沒有真實訂購。示範人物不會自動回覆。
              </Text>
            ) : null}
            {query.error && !mutation.error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {coreError(query.error)}
              </Text>
            ) : null}
            <View style={{ flex: 1 }}>
              <FlatList
                onViewableItemsChanged={dates.onViewableItemsChanged}
                onScroll={dates.onScroll}
                scrollEventThrottle={100}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                inverted
                data={messages}
                keyExtractor={(message) => message.id}
                contentContainerStyle={styles.list}
                ListFooterComponent={
                  query.hasNextPage ? (
                    <PrimaryButton
                      secondary
                      disabled={query.isFetchingNextPage}
                      onPress={() => {
                        void query.fetchNextPage();
                      }}
                    >
                      載入較早訊息
                    </PrimaryButton>
                  ) : null
                }
                renderItem={({ item }) =>
                  item.event_kind ? (
                    <Text
                      style={{
                        textAlign: 'center',
                        color: colors.muted,
                        fontSize: 12,
                        paddingVertical: 8,
                      }}
                    >
                      {item.content}
                    </Text>
                  ) : (
                    <View style={[styles.message, item.sender_id === user?.id && styles.mine]}>
                      {item.sender_id !== user?.id ? (
                        <View style={styles.sender}>
                          <Avatar name={item.sender_name} badge={item.sender_badge} size={28} />
                          <Text style={styles.muted}>{item.sender_name}</Text>
                          <ReputationBadge level={item.sender_level} />
                        </View>
                      ) : null}
                      <View
                        style={[
                          styles.bubble,
                          item.sender_id === user?.id && styles.mineBubble,
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
                          <InlineLoading label="傳送中" textStyle={styles.muted} />
                        ) : (
                          <Text style={styles.muted}>尚未送出，請重試</Text>
                        )
                      ) : null}
                      <Text style={styles.muted}>{displayTime(item.created_at)}</Text>
                      {item.sender_id !== user?.id ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="檢舉這則訊息"
                          onPress={() =>
                            router.push({
                              pathname: '/report',
                              params: { kind: 'message', targetId: item.id },
                            })
                          }
                        >
                          <MaterialCommunityIcons
                            name="flag-outline"
                            size={14}
                            color={colors.subtle}
                          />
                        </Pressable>
                      ) : null}
                    </View>
                  )
                }
              />
              {dates.indicator}
            </View>
            {mutation.error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {coreError(mutation.error)} 內容已保留，可重試。
              </Text>
            ) : null}
            {current.can_send ? (
              <ChatComposer
                kind="group"
                threadId={id}
                disabled={mutation.isPending}
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
                  accessibilityLabel="聊天訊息"
                  placeholder="協調取餐、時間或集合點"
                  value={text}
                  onChangeText={setText}
                  maxLength={2000}
                  multiline
                  editable={!mutation.isPending}
                  style={styles.input}
                />
                <ChatSendButton
                  disabled={!text.trim() || mutation.isPending}
                  onPress={send}
                  loading={mutation.isPending}
                />
              </ChatComposer>
            ) : (
              <Text style={styles.note}>拼單已取消，聊天室只供查看紀錄。</Text>
            )}
          </KeyboardViewport>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  inboxRow: {
    minHeight: 94,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  conversation: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    minWidth: 0,
  },
  unreadDot: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.danger,
    borderWidth: 1,
    borderColor: colors.background,
  },
  unreadBadge: {
    minWidth: 22,
    padding: 4,
    textAlign: 'center',
    borderRadius: 11,
    color: '#fff',
    backgroundColor: colors.danger,
    fontSize: 12,
  },
  preview: { color: colors.ink, fontSize: 14 },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#00000055',
  },
  menu: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: 12,
  },
  list: {
    paddingHorizontal: 8,
    paddingVertical: spacing.md,
    gap: spacing.md,
    paddingBottom: 24,
    flexGrow: 1,
  },
  card: {
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  title: { color: colors.ink, fontSize: 16, lineHeight: 24, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  note: { padding: spacing.md, color: colors.muted, fontSize: 13, lineHeight: 21 },
  error: { padding: spacing.sm, color: colors.danger, fontSize: 13, lineHeight: 20 },
  topic: { padding: spacing.md, borderBottomWidth: 1, borderColor: colors.border },
  message: { gap: 5, alignItems: 'flex-start', marginBottom: spacing.md },
  mine: { alignItems: 'flex-end' },
  sender: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bubble: {
    maxWidth: '88%',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 22,
  },
  mineBubble: { backgroundColor: colors.yellow },
  photoBubble: { backgroundColor: 'transparent', padding: 0, borderRadius: 0 },
  body: { color: colors.ink, fontSize: 16, lineHeight: 24 },
  composer: {
    padding: spacing.sm,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.ink,
    fontSize: 16,
  },
});
