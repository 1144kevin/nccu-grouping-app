import { useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { FlatList, StyleSheet, View } from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '@/components/app-text';
import { KeyboardViewport, KeyboardScrollView } from '@/components/keyboard-layout';
import { DetailHeader, PrimaryButton, Screen } from '@/components/primitives';
import { StealthFormation } from '@/components/core-stealth-formation';
import { coreError, newRequestKey } from '@/lib/core-api';
import { useCoreScreenFocused } from '@/lib/core-hooks';
import { useCoreClock } from '@/lib/core-clock';
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
    refetchInterval: focused ? 5000 : false,
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
  const frozen = useRef<{ text: string; key: string } | null>(null);
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: key });
  };
  const send = useMutation({
    retry: false,
    gcTime: 0,
    mutationFn: async () => {
      const content = text.trim();
      if (frozen.current?.text !== content)
        frozen.current = { text: content, key: newRequestKey() };
      return stealthApi.roomSend(id, content, frozen.current.key);
    },
    onSuccess: async () => {
      if (useAuthStore.getState().user?.id !== actor) return;
      setText('');
      frozen.current = null;
      await query.refetch();
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
          <Text style={styles.note}>這組配對已撤回或過期，訊息保留唯讀。</Text>
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
            data={query.data?.items ?? []}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messages}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            renderItem={({ item }) => (
              <View style={[styles.message, item.is_me && styles.mine]}>
                <Text style={styles.hint}>{item.is_me ? '你' : `夥伴 ${item.member_number}`}</Text>
                <Text style={styles.body}>{item.content}</Text>
              </View>
            )}
          />
        )}
        {match && match.status !== 'unavailable' && query.data?.opened ? (
          <PrimaryButton secondary onPress={() => setFormal(!formal)}>
            {formal ? '回到聊天' : '談好了，確認正式拼單'}
          </PrimaryButton>
        ) : null}
        {!formal ? (
          <View style={styles.composer}>
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
            >
              {send.isPending ? '送出中…' : '傳送'}
            </PrimaryButton>
          </View>
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
  body: { fontSize: 16, color: colors.ink, lineHeight: 24 },
  hint: { color: colors.muted, fontSize: 12 },
  composer: { padding: spacing.sm, gap: spacing.sm },
  input: {
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
