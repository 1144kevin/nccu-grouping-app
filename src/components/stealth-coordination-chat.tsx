import { useRef, useState } from 'react';
import { InlineLoading } from '@/components/inline-loading';
import { ChatComposer, ChatPhoto } from '@/components/chat-composer';
import { useMutation, useQuery } from '@tanstack/react-query';
import { FlatList, StyleSheet, View } from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '@/components/app-text';
import { KeyboardViewport, KeyboardScrollView } from '@/components/keyboard-layout';
import { DetailHeader, PrimaryButton, Screen } from '@/components/primitives';
import { StealthFormation } from '@/components/core-stealth-formation';
import { StealthReplySuggestions } from '@/components/stealth-reply-suggestions';
import { coreError, newRequestKey } from '@/lib/core-api';
import { useCoreScreenFocused } from '@/lib/core-hooks';
import { useCoreClock } from '@/lib/core-clock';
import { useChatOutbox } from '@/lib/chat-outbox';
import type { StealthRoomMessage } from '@/lib/stealth-api';
import { stealthApi } from '@/lib/stealth-api';
import { queryClient } from '@/lib/query-client';
import { useAuthStore } from '@/store/auth-store';
import { colors, spacing } from '@/theme/tokens';

export function StealthCoordinationChat({ id }: { id: string }) {
  const actor = useAuthStore((s) => s.user?.id);
  return <Chat key={`${actor}:${id}`} id={id} actor={actor} />;
}

function Chat({ id, actor }: { id: string; actor?: string }) {
  const focused = useCoreScreenFocused();
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
  return (
    <Screen>
      <DetailHeader title="偷揪 · 聊聊細節" />
      <KeyboardViewport>
        <Text style={styles.note}>先聊品項與取餐分工，談好後再確認成團。</Text>
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
            />
          </KeyboardScrollView>
        ) : (
          <FlatList
            data={outbox.items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messages}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            renderItem={({ item }) => (
              <View
                style={[
                  styles.message,
                  item.is_me && styles.mine,
                  item.image_id && styles.photoMessage,
                ]}
              >
                <Text style={styles.hint}>{item.is_me ? '你' : `夥伴 ${item.member_number}`}</Text>
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
              </View>
            )}
          />
        )}
        {match && match.status !== 'unavailable' && query.data?.opened ? (
          <PrimaryButton secondary onPress={() => setFormal(!formal)}>
            {formal ? '回到聊天' : '談好了，確認正式拼單'}
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
            onSelect={setText}
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
              multiline
              maxLength={2000}
              editable={query.data?.can_send && !send.isPending}
              style={styles.input}
            />
            <PrimaryButton
              disabled={!focused || !query.data?.can_send || send.isPending || !text.trim()}
              onPress={() => send.mutate()}
              loading={send.isPending}
            >
              {send.isPending ? '送出中' : '傳送'}
            </PrimaryButton>
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
  error: { padding: spacing.sm, color: colors.danger },
  messages: { padding: spacing.md, gap: spacing.sm },
  message: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 12,
    alignSelf: 'flex-start',
    maxWidth: '90%',
  },
  mine: { backgroundColor: colors.yellowSoft, alignSelf: 'flex-end' },
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
