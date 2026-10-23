import { useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { SegmentedTabs, shortDate } from '@/components/list-ui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardViewport } from '@/components/keyboard-layout';
import { AppText as Text, AppTextInput as TextInput } from '@/components/app-text';
import {
  AppHeader,
  Avatar,
  DetailHeader,
  EmptyState,
  IconButton,
  PrimaryButton,
  Screen,
} from '@/components/primitives';
import { coreApi, coreError, newRequestKey } from '@/lib/core-api';
import { invalidateCore, useCoreScreenFocused } from '@/lib/core-hooks';
import { useCoreChatActivity } from '@/lib/core-chat-hooks';
import { queryClient } from '@/lib/query-client';
import { chatMessagesNewestFirst } from '@/lib/chat-message-pages';
import { useAuthStore } from '@/store/auth-store';
import { colors, radius, spacing } from '@/theme/tokens';
import { engagementApi, useInboxPreferences, type InboxPreference } from '@/lib/engagement-api';

export function CoreInbox() {
  const user = useAuthStore((state) => state.user);
  const focused = useCoreScreenFocused();
  const activity = useCoreChatActivity(false);
  const inbox = useInboxPreferences();
  const [archived, setArchived] = useState(false);
  const query = useInfiniteQuery({
    queryKey: ['core', user?.id, 'conversations'],
    queryFn: ({ pageParam }) => coreApi.conversations(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    enabled: !!user && focused,
    refetchInterval: 10_000,
  });
  const items = (query.data?.pages.flatMap((page) => page.items) ?? []).filter(
    (item) =>
      Boolean(inbox.data?.items.find((p) => p.post_id === item.post.id)?.archived) === archived,
  );
  return (
    <Screen>
      <AppHeader searchScope="messages" />
      <SegmentedTabs
        value={archived ? 'archived' : 'all'}
        onChange={(value) => setArchived(value === 'archived')}
        options={[
          { value: 'all', label: '收件匣' },
          { value: 'archived', label: '已封存' },
        ]}
      />
      {inbox.error ? (
        <>
          <Text accessibilityRole="alert" style={styles.error}>
            {coreError(inbox.error)}
          </Text>
          <PrimaryButton
            secondary
            onPress={() => {
              void inbox.refetch();
            }}
          >
            重試載入聊天室偏好
          </PrimaryButton>
        </>
      ) : null}
      {query.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {coreError(query.error)}
        </Text>
      ) : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.post.id}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={query.isFetching && !query.isFetchingNextPage}
            onRefresh={() => {
              void query.refetch();
            }}
          />
        }
        ListEmptyComponent={
          query.isPending ? (
            <ActivityIndicator />
          ) : (
            <EmptyState
              icon="chat-outline"
              title={query.error ? '聊天室載入失敗' : '加入拼單後，就能在這裡協調取餐'}
              action={
                query.error ? (
                  <PrimaryButton
                    secondary
                    onPress={() => {
                      void query.refetch();
                    }}
                  >
                    重試
                  </PrimaryButton>
                ) : undefined
              }
            />
          )
        }
        ListFooterComponent={
          query.hasNextPage ? (
            <PrimaryButton
              secondary
              disabled={query.isFetchingNextPage}
              onPress={() => {
                void query.fetchNextPage();
              }}
            >
              載入更多聊天室
            </PrimaryButton>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.inboxRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`開啟聊天室 ${item.post.content}`}
              onPress={() => router.push(`/chat/${item.post.id}`)}
              style={styles.conversation}
            >
              <View>
                <Avatar
                  name={item.post.author_name}
                  badge={item.post.author_badge ?? '🍱'}
                  size={54}
                />
                {(activity.data?.groups.find((g) => g.post_id === item.post.id)?.unread_count ??
                  0) > 0 ? (
                  <View style={styles.unreadDot} />
                ) : null}
              </View>
              <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Text numberOfLines={1} style={[styles.title, { flex: 1 }]}>
                    {item.post.author_name}
                  </Text>
                  <Text style={styles.muted}>
                    {shortDate(item.last_message?.created_at ?? item.post.created_at)}
                  </Text>
                </View>
                <Text numberOfLines={1} style={styles.preview}>
                  {item.post.content}
                </Text>
                <Text numberOfLines={1} style={styles.muted}>
                  {item.last_message
                    ? `${item.last_message.sender_name}：${item.last_message.content}`
                    : '開始聊聊吧'}
                </Text>
                {item.post.status === 'cancelled' ? (
                  <Text style={styles.muted}>已取消 · 唯讀</Text>
                ) : null}
              </View>
              {(activity.data?.groups.find((g) => g.post_id === item.post.id)?.unread_count ?? 0) >
              0 ? (
                <Text style={styles.unreadBadge}>
                  {activity.data?.groups.find((g) => g.post_id === item.post.id)?.unread_count}
                </Text>
              ) : null}
            </Pressable>
            {inbox.data ? (
              <InboxActions
                value={
                  inbox.data.items.find((p) => p.post_id === item.post.id) ?? {
                    post_id: item.post.id,
                    muted: false,
                    archived: false,
                  }
                }
              />
            ) : null}
          </View>
        )}
      />
    </Screen>
  );
}

function InboxActions({ value }: { value: InboxPreference }) {
  const actor = useAuthStore((state) => state.user?.id);
  const [menu, setMenu] = useState(false);
  const save = useMutation({
    mutationFn: (next: { muted: boolean; archived: boolean }) =>
      engagementApi.saveInbox(value.post_id, next),
    onSuccess: (updated) => {
      if (useAuthStore.getState().user?.id !== actor) return;
      queryClient.setQueryData<{ items: InboxPreference[] }>(
        ['core', actor, 'inbox-preferences'],
        (old) => ({
          items: [...(old?.items.filter((p) => p.post_id !== updated.post_id) ?? []), updated],
        }),
      );
      setMenu(false);
      void queryClient.invalidateQueries({ queryKey: ['core', actor, 'chat-activity'] });
    },
  });
  return (
    <>
      <IconButton icon="dots-horizontal" label="聊天室選項" onPress={() => setMenu(true)} />
      <Modal transparent visible={menu} animationType="fade" onRequestClose={() => setMenu(false)}>
        <View style={styles.overlay}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="關閉聊天室選項"
            style={StyleSheet.absoluteFill}
            onPress={() => setMenu(false)}
          />
          <View style={styles.menu} accessibilityViewIsModal>
            <Text style={styles.title}>聊天室選項</Text>
            <PrimaryButton
              secondary
              disabled={save.isPending}
              onPress={() => save.mutate({ muted: !value.muted, archived: value.archived })}
            >
              {value.muted ? '取消靜音' : '靜音提示'}
            </PrimaryButton>
            <PrimaryButton
              secondary
              disabled={save.isPending}
              onPress={() => save.mutate({ muted: value.muted, archived: !value.archived })}
            >
              {value.archived ? '移回收件匣' : '封存聊天室'}
            </PrimaryButton>
            {save.error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {coreError(save.error)}
              </Text>
            ) : null}
            <PrimaryButton secondary onPress={() => setMenu(false)}>
              取消
            </PrimaryButton>
          </View>
        </View>
      </Modal>
    </>
  );
}

export function CoreGroupChat({ id }: { id: string }) {
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
    refetchInterval: 10_000,
    retry: false,
    gcTime: 0,
  });
  const mutation = useMutation({
    mutationFn: (value: { text: string; key: string }) =>
      coreApi.sendMessage(id, value.text, value.key),
    onSuccess: () => {
      setText('');
      draft.current = null;
    },
    onSettled: invalidateCore,
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
  const messages = chatMessagesNewestFirst(query.data?.pages ?? []);
  function send() {
    const value = text.trim();
    if (!value || !current?.can_send || mutation.isPending) return;
    if (draft.current?.text !== value) draft.current = { text: value, key: newRequestKey() };
    mutation.mutate(draft.current);
  }
  return (
    <Screen>
      <DetailHeader
        title="拼單聊天室"
        right={
          <IconButton
            icon="refresh"
            label="重新整理訊息"
            disabled={query.isFetching}
            onPress={() => {
              void query.refetch();
            }}
          />
        }
      />
      {!current || denied ? (
        <View style={styles.list}>
          {query.isPending ? (
            <ActivityIndicator />
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
        <SafeAreaView edges={['bottom']} style={{ flex: 1 }}>
          <KeyboardViewport>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="查看這筆拼單"
              style={styles.topic}
              onPress={() => router.push(`/post/${id}`)}
            >
              <Text numberOfLines={2} style={styles.title}>
                {current.post.content.split('\n')[0]}
              </Text>
            </Pressable>
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
            <FlatList
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              inverted
              data={messages}
              keyExtractor={(message) => message.id}
              contentContainerStyle={styles.list}
              ListEmptyComponent={<Text style={styles.muted}>還沒有訊息，開始協調取餐吧。</Text>}
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
              renderItem={({ item }) => (
                <View style={[styles.message, item.sender_id === user?.id && styles.mine]}>
                  <View style={styles.sender}>
                    <Avatar name={item.sender_name} badge={item.sender_badge} size={28} />
                    <Text style={styles.muted}>{item.sender_name}</Text>
                  </View>
                  <View style={[styles.bubble, item.sender_id === user?.id && styles.mineBubble]}>
                    <Text style={styles.body}>{item.content}</Text>
                  </View>
                  <Text style={styles.muted}>
                    {new Date(item.created_at).toLocaleString('zh-TW')}
                  </Text>
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
                      <Text style={styles.muted}>檢舉這則訊息</Text>
                    </Pressable>
                  ) : null}
                </View>
              )}
            />
            {mutation.error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {coreError(mutation.error)} 內容已保留，可重試。
              </Text>
            ) : null}
            {current.can_send ? (
              <View style={styles.composer}>
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
                <PrimaryButton disabled={!text.trim() || mutation.isPending} onPress={send}>
                  {mutation.isPending ? '傳送中…' : '傳送'}
                </PrimaryButton>
              </View>
            ) : (
              <Text style={styles.note}>拼單已取消，聊天室只供查看紀錄。</Text>
            )}
          </KeyboardViewport>
        </SafeAreaView>
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
  list: { padding: spacing.md, gap: spacing.md, paddingBottom: 24 },
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
    borderRadius: radius.md,
  },
  mineBubble: { backgroundColor: colors.yellow },
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
