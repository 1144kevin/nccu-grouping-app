import { useEffect, useRef, useState } from 'react';
import { InlineLoading } from '@/components/inline-loading';
import { ChatComposer, ChatPhoto } from '@/components/chat-composer';
import { useMutation, useQuery } from '@tanstack/react-query';
import { FlatList, StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/app-text';
import { ChatTextInput as TextInput } from '@/components/chat-text-input';
import { KeyboardViewport, KeyboardScrollView, useKeyboardOpen } from '@/components/keyboard-layout';
import { Avatar, DetailHeader, PrimaryButton, Screen, IconButton } from '@/components/primitives';
import { ReputationBadge } from '@/components/reputation-badge';
import { ChatSendButton } from './chat-controls';
import { useChatDateIndicator } from './chat-date-indicator';
import { displayTime } from '@/lib/display-time';
import { displayTimestamp } from '@/lib/display-time';
import { router } from 'expo-router';
import { StealthFormation } from '@/components/core-stealth-formation';
import { StealthReplySuggestions } from '@/components/stealth-reply-suggestions';
import { coreError, newRequestKey } from '@/lib/core-api';
import { socialApi } from '@/lib/social-api';
import { useCoreScreenFocused } from '@/lib/core-hooks';
import { useCoreClock } from '@/lib/core-clock';
import { useChatOutbox } from '@/lib/chat-outbox';
import type { StealthRoomMessage } from '@/lib/stealth-api';
import { stealthApi } from '@/lib/stealth-api';
import { queryClient } from '@/lib/query-client';
import { updateInboxAfterRead } from '@/lib/inbox-read';
import { useAuthStore } from '@/store/auth-store';
import { colors, spacing, yellowSurface } from '@/theme/tokens';

export function StealthCoordinationChat({ id }: { id: string }) {
  const actor = useAuthStore((s) => s.user?.id);
  return <Chat key={`${actor}:${id}`} id={id} actor={actor} />;
}

function Chat({ id, actor }: { id: string; actor?: string }) {
  const dates = useChatDateIndicator(false);
  const focused = useCoreScreenFocused();
  const keyboardOpen = useKeyboardOpen();
  const [inputFocused, setInputFocused] = useState(false);
  const clock = useCoreClock();
  const key = ['core', actor, 'stealth'];
  const query = useQuery({
    queryKey: [...key, 'room', id],
    queryFn: () => stealthApi.room(id),
    enabled: !!actor && focused,
    refetchInterval: focused ? 2000 : false,
  });
  const matches = useQuery({
    queryKey: [...key, 'matches'],
    queryFn: stealthApi.matches,
    enabled: !!actor && focused,
    refetchInterval: focused ? 10_000 : false,
  });
  const match = matches.data?.items.find((m) => m.id === id);
  const formedOrder = useQuery({
    queryKey: ['core', actor, 'order-summary', match?.formed_post_id],
    queryFn: () => socialApi.order(match!.formed_post_id!),
    enabled: !!actor && focused && !!match?.formed_post_id,
    retry: false,
    refetchInterval: focused ? 10_000 : false,
  });
  const sortedMembers = formedOrder.data?.members
    ? [...formedOrder.data.members].sort((a, b) => a.id.localeCompare(b.id))
    : [];
  const latestRoomMessage = query.data?.items.at(-1)?.id;
  useEffect(() => {
    if (actor && focused && query.data?.opened && latestRoomMessage) {
      void updateInboxAfterRead(queryClient, actor, 'stealth', id, latestRoomMessage);
      void queryClient.invalidateQueries({ queryKey: ['core', actor, 'notification-badge'] });
    }
  }, [actor, focused, id, query.data?.opened, latestRoomMessage]);
  useEffect(() => {
    if (!actor || !query.data?.opened) return;
    queryClient.setQueryData<Awaited<ReturnType<typeof stealthApi.matches>>>(
      ['core', actor, 'stealth', 'matches'],
      (old) =>
        old
          ? {
              ...old,
              items: old.items.map((item) =>
                item.id === id ? { ...item, coordination_opened: true } : item,
              ),
            }
          : old,
    );
  }, [actor, id, query.data?.opened]);
  const [text, setText] = useState('');
  const [formal, setFormal] = useState(false);
  const replyContext = JSON.stringify({
    messages: query.data?.items.slice(-20).map((m) => m.id),
    match: match && [
      match.id,
      match.status,
      match.category,
      match.location_id,
      match.my_signal_title,
      match.terms_revision,
      match.my_roles,
      match.unknowns,
      match.known_cost_twd,
      match.budget_max_twd,
    ],
  });
  const frozen = useRef<{ text: string; key: string } | null>(null);
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: key });
  };
  const outbox = useChatOutbox<StealthRoomMessage>(query.data?.items ?? [], false);
  const ownMessage = (content: string, messageId: string): StealthRoomMessage => ({
    id: messageId,
    content,
    created_at: new Date().toISOString(),
    member_number: match?.my_member_number ?? 1,
    is_me: true,
  });
  function pendingDraft() {
    const content = text.trim();
    if (frozen.current?.text !== content) frozen.current = { text: content, key: newRequestKey() };
    return frozen.current;
  }
  const send = useMutation({
    retry: false,
    gcTime: 0,
    mutationFn: () => {
      const pending = pendingDraft();
      return stealthApi.roomSend(id, pending.text, pending.key);
    },
    onMutate: () => {
      const pending = pendingDraft();
      outbox.begin(pending.key, ownMessage(pending.text, `local:${pending.key}`));
    },
    onSuccess: (message) => {
      if (useAuthStore.getState().user?.id !== actor) return;
      if (frozen.current) outbox.confirm(frozen.current.key, message);
      setText('');
      frozen.current = null;
      void query.refetch();
    },
    onError: () => {
      if (frozen.current) outbox.fail(frozen.current.key);
    },
  });
  const accept = useMutation({
    mutationFn: (revision: number) => stealthApi.consent(id, revision),
    onSettled: async () => { await refresh(); await query.refetch(); },
  });
  const formedIndex = outbox.items.findIndex((item) => item.event_kind === 'formed');
  return (
    <Screen pinKeyboardHeader>
      <DetailHeader
        title="偷揪 · 聊聊細節"
        right={
          match?.formed_post_id ? (
            <IconButton
              icon="file-document-outline"
              label="查看拼單詳情"
              onPress={() => router.push(`/order/${match.formed_post_id}`)}
            />
          ) : undefined
        }
      />
      <KeyboardViewport>
        {query.error ? (
          <>
            <Text accessibilityRole="alert" style={styles.error}>
              {coreError(query.error)}
            </Text>
            <PrimaryButton
              secondary
              onPress={() => {
                void query.refetch();
              }}
            >
              重試載入聊天室
            </PrimaryButton>
          </>
        ) : null}
        {!query.isPending && query.data && !query.data.opened ? (
          <Text style={styles.note}>還在等待其他夥伴同意，全部同意後才能聊天。</Text>
        ) : null}
        {query.data?.opened && !query.data.can_send ? (
          <Text style={styles.note}>有人撤回、封鎖或拼單已取消，訊息保留唯讀。</Text>
        ) : null}
        {formal && match ? (
          <KeyboardScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.md }}>
            <StealthFormation
              match={match}
              refresh={refresh}
              now={clock.data ? clock.now : undefined}
              onSubmitted={() => { setFormal(false); void query.refetch(); }}
            />
          </KeyboardScrollView>
        ) : (
          <View style={{ flex: 1, minHeight: 0 }}>
            <FlatList
              onViewableItemsChanged={dates.onViewableItemsChanged}
              onScroll={dates.onScroll}
              scrollEventThrottle={100}
              data={outbox.items}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.messages}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              renderItem={({ item, index }) => {
                if (item.event_kind === 'formed') {
                  return <Text style={styles.formedDivider}>偷揪成立</Text>;
                }
                if (item.event_kind === 'terms' && item.event_terms) {
                  return (
                    <View style={styles.message}>
                      <Text style={styles.body}>{item.event_terms.content}</Text>
                      <Text style={styles.body}>每人 NT$ {item.event_terms.cost_per_person_twd}</Text>
                      <Text style={styles.body}>{displayTimestamp(item.event_terms.deadline_at)}</Text>
                      <Text style={styles.body}>買：夥伴 {item.event_terms.order_member} · 取：夥伴 {item.event_terms.pickup_member}</Text>
                      {match && item.terms_revision === match.terms_revision && match.status !== 'formed' ? (
                        <PrimaryButton
                          disabled={!!match.my_terms_accepted || accept.isPending}
                          loading={accept.isPending}
                          onPress={() => accept.mutate(item.terms_revision!)}
                          style={styles.consentButton}
                        >
                          {match.my_terms_accepted ? '已接受' : '接受'} {match.confirmed_count}/{match.member_count}
                        </PrimaryButton>
                      ) : <Text style={[styles.hint, { marginTop: 10, textAlign: 'center' }]}>{match?.status === 'formed' && item.terms_revision === match.terms_revision ? '已成立' : '方案已更新'}</Text>}
                      {accept.error ? <Text accessibilityRole="alert" style={styles.error}>{coreError(accept.error)}</Text> : null}
                    </View>
                  );
                }
                const afterFormed = formedIndex !== -1 && index > formedIndex;
                const member = afterFormed ? sortedMembers[item.member_number - 1] : undefined;
                return (
                  <View style={[styles.messageRow, item.is_me && styles.mineRow]}>
                    {afterFormed ? (
                      <View style={[styles.senderProfile, item.is_me && styles.mineSenderProfile]}>
                        <Avatar
                          name={member?.name ?? `夥伴 ${item.member_number}`}
                          badge={member?.badge ?? '🍱'}
                          userId={member?.id}
                          onPress={member?.id ? () => router.push(`/user/${member.id}`) : undefined}
                          size={26}
                        />
                        <Text style={styles.senderName}>
                          {member?.name ?? `夥伴 ${item.member_number}`}
                        </Text>
                        {member?.level != null ? <ReputationBadge level={member.level} /> : null}
                      </View>
                    ) : null}
                    <View
                      style={[
                        styles.message,
                        item.is_me && styles.mine,
                        item.image_id && styles.photoMessage,
                      ]}
                    >
                      {!afterFormed && !item.is_me ? (
                        <Text style={styles.hint}>{`夥伴 ${item.member_number}`}</Text>
                      ) : null}
                      {item.image_id ? (
                        <ChatPhoto imageId={item.image_id} localUri={item.local_image_uri} />
                      ) : (
                        <Text style={styles.body}>{item.content}</Text>
                      )}
                      {item.delivery ? (
                        item.delivery === 'sending' ? (
                          <InlineLoading label="傳送中" textStyle={styles.hint} />
                        ) : (
                          <Text style={styles.hint}>尚未送出，請重試</Text>
                        )
                      ) : null}
                      <Text style={styles.hint}>{displayTime(item.created_at)}</Text>
                    </View>
                  </View>
                );
              }}
            />
            {dates.indicator}
          </View>
        )}
        {formal && match && match.status !== 'unavailable' && query.data?.opened ? (
          <PrimaryButton secondary style={{ marginHorizontal: spacing.md, marginBottom: spacing.xl }} onPress={() => setFormal(!formal)}>
            回到聊天
          </PrimaryButton>
        ) : null}
        {!formal && actor && match && query.data?.opened && query.data.can_send && !query.error ? (
          <StealthReplySuggestions
            key={replyContext}
            id={id}
            actor={actor}
            contextKey={replyContext}
            enabled={focused}
            disabled={send.isPending}
            collapsed={keyboardOpen || inputFocused}
            onSelect={setText}
            onPlan={() => setFormal(true)}
          />
        ) : null}
        {!formal ? (
          <ChatComposer
            kind="stealth"
            threadId={id}
            disabled={!focused || !query.data?.can_send || send.isPending}
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
              accessibilityLabel="偷揪聊天室訊息"
              placeholder="想喝什麼？我們怎麼分工？"
              value={text}
              onChangeText={setText}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              multiline
              maxLength={2000}
              editable={query.data?.can_send && !send.isPending}
              style={styles.input}
            />
            <ChatSendButton
              disabled={!focused || !query.data?.can_send || send.isPending || !text.trim()}
              onPress={() => send.mutate()}
              loading={send.isPending}
            />
          </ChatComposer>
        ) : null}
        {send.error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {coreError(send.error)} 文字已保留，重試不會重複傳送。
          </Text>
        ) : null}
      </KeyboardViewport>
    </Screen>
  );
}
const styles = StyleSheet.create({
  note: { padding: spacing.md, color: colors.muted, lineHeight: 21, fontSize: 13 },
  formedDivider: {
    textAlign: 'center',
    color: colors.muted,
    fontSize: 12,
    paddingVertical: 8,
  },
  consentButton: {
    alignSelf: 'center',
    marginTop: 14,
    minHeight: 32,
    paddingHorizontal: 18,
    paddingVertical: 5,
    borderRadius: 999,
  },
  messageRow: { alignItems: 'flex-start', gap: 4 },
  mineRow: { alignItems: 'flex-end' },
  senderProfile: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  mineSenderProfile: { flexDirection: 'row-reverse' },
  senderName: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  error: { padding: spacing.sm, color: colors.danger },
  messages: { paddingHorizontal: 8, paddingVertical: spacing.md, gap: spacing.sm, flexGrow: 1 },
  message: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 22,
    alignSelf: 'flex-start',
    maxWidth: '90%',
  },
  mine: { ...yellowSurface, backgroundColor: colors.yellowSoft, alignSelf: 'flex-end' },
  photoMessage: { backgroundColor: 'transparent', padding: 0 },
  body: { fontSize: 16, color: colors.ink, lineHeight: 24 },
  hint: { color: colors.muted, fontSize: 12 },
  composer: { padding: spacing.sm, gap: spacing.sm },
  input: {
    flex: 1,
    minHeight: 45,
    maxHeight: 120,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    color: colors.ink,
    fontSize: 16,
  },
});
