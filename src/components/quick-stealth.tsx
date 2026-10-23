import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '@/components/app-text';
import { KeyboardScrollView } from '@/components/keyboard-layout';
import { DetailHeader, PrimaryButton, Screen } from '@/components/primitives';
import { coreError, newRequestKey } from '@/lib/core-api';
import { useCoreScreenFocused } from '@/lib/core-hooks';
import { queryClient } from '@/lib/query-client';
import {
  stealthApi,
  type StealthMatch,
  type StealthQuickResult,
  type StealthSemanticResult,
} from '@/lib/stealth-api';
import { selectSemanticMatches } from '@/lib/stealth-semantic';
import { useCoreClock } from '@/lib/core-clock';
import { useAuthStore } from '@/store/auth-store';
import { colors, radius, spacing } from '@/theme/tokens';

export function QuickStealthScreen({ onAdvanced }: { onAdvanced: () => void }) {
  const actor = useAuthStore((s) => s.user?.id);
  return <QuickSession key={actor} actor={actor} onAdvanced={onAdvanced} />;
}

function QuickSession({ actor, onAdvanced }: { actor?: string; onAdvanced: () => void }) {
  const focused = useCoreScreenFocused();
  const current = useRef(true);
  useEffect(() => {
    current.current = focused;
    return () => {
      current.current = false;
    };
  }, [focused]);
  const sameActor = () => current.current && useAuthStore.getState().user?.id === actor;
  const key = ['core', actor, 'stealth'];
  const capability = useQuery({
    queryKey: [...key, 'quick-status'],
    queryFn: stealthApi.quickStatus,
    enabled: !!actor && focused,
    refetchInterval: focused ? 30_000 : false,
  });
  const agent = useQuery({
    queryKey: [...key, 'agent'],
    queryFn: stealthApi.agent,
    enabled: !!actor && focused,
  });
  const matches = useQuery({
    queryKey: [...key, 'matches'],
    queryFn: stealthApi.matches,
    enabled: !!actor && focused,
    refetchInterval: focused ? 10_000 : false,
  });
  const signals = useQuery({
    queryKey: [...key, 'signals'],
    queryFn: stealthApi.signals,
    enabled: !!actor && focused,
    refetchInterval: focused ? 10_000 : false,
  });
  const clock = useCoreClock();
  const [text, setText] = useState('');
  const [phase, setPhase] = useState('');
  const [saved, setSaved] = useState<StealthQuickResult>();
  const [analysis, setAnalysis] = useState<StealthSemanticResult>();
  const [notice, setNotice] = useState('');
  const [details, setDetails] = useState(false);
  const [decided, setDecided] = useState<string[]>([]);
  const request = useRef<{ text: string; key: string } | null>(null);
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: key });
  };
  const start = useMutation({
    retry: false,
    gcTime: 0,
    mutationFn: async () => {
      const sentence = text.trim();
      if (request.current?.text !== sentence)
        request.current = { text: sentence, key: newRequestKey() };
      setNotice('');
      setAnalysis(undefined);
      setPhase('分身正在理解你的想法…');
      const result = await stealthApi.quickStart(
        sentence,
        !agent.data?.enabled,
        request.current.key,
      );
      if (!sameActor()) return;
      setSaved(result);
      await refresh();
      if (!sameActor()) return;
      setNotice('已交給分身，會持續留意平台上的合適需求。');
      if (sameActor()) {
        setPhase('');
        request.current = null;
        setText('');
      }
    },
  });
  const retry = useMutation({
    retry: false,
    gcTime: 0,
    mutationFn: async () => {
      setNotice('');
      await stealthApi.discover();
      if (!sameActor()) return;
      await refresh();
      const response = await stealthApi.semantic();
      if (sameActor()) {
        setAnalysis(response);
        await refresh();
      }
    },
  });
  const revoke = useMutation({ mutationFn: stealthApi.revoke, onSettled: refresh });
  const busy = start.isPending || retry.isPending;
  const now = clock.now();
  const active = (signals.data?.items ?? []).filter(
    (s) => s.status === 'active' && Date.parse(s.expires_at) > now,
  );
  const { ordered, valid } = selectSemanticMatches(
    matches.data?.items ?? [],
    focused ? analysis : undefined,
    now,
  );
  const visible = ordered.filter(
    (m) =>
      m.status === 'pending' &&
      m.my_decision === 'pending' &&
      Date.parse(m.expires_at) > now &&
      !decided.includes(m.id),
  );
  return (
    <Screen>
      <DetailHeader title="偷揪" />
      <KeyboardScrollView contentContainerStyle={styles.page}>
        <View style={styles.hero}>
          <View style={styles.headingRow}>
            <View style={styles.agentIcon}>
              <MaterialCommunityIcons name="robot-outline" size={25} color={colors.brown} />
            </View>
            <View>
              <Text style={styles.title}>讓分身幫你揪</Text>
              <Text style={styles.hint}>說一次，替你持續留意</Text>
            </View>
          </View>

          <TextInput
            accessibilityLabel="一句話告訴分身"
            placeholder="我今天想喝50嵐"
            multiline
            maxLength={160}
            value={text}
            onChangeText={setText}
            editable={!busy}
            style={styles.input}
          />
          <Text style={styles.hint}>正門 · 接下來兩小時，可在描述中更改</Text>
          {!agent.data?.enabled ? (
            <Text style={styles.hint}>啟用後會儲存需求，替你找夥伴。</Text>
          ) : null}
          <PrimaryButton
            disabled={
              busy ||
              !focused ||
              agent.isPending ||
              !!agent.error ||
              !capability.data?.ready ||
              !text.trim()
            }
            onPress={() => start.mutate()}
          >
            {busy ? phase || '分身正在找人…' : agent.data?.enabled ? '幫我揪' : '啟用分身並幫我揪'}
          </PrimaryButton>
          {!capability.isPending && !capability.data?.ready ? (
            <Text style={styles.hint}>目前無法自動找人，請先使用進階設定。</Text>
          ) : null}
          {agent.error ? (
            <>
              <Text accessibilityRole="alert" style={styles.error}>
                {coreError(agent.error)}
              </Text>
              <PrimaryButton
                secondary
                onPress={() => {
                  void agent.refetch();
                }}
              >
                重試連線
              </PrimaryButton>
            </>
          ) : null}
          {start.error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {coreError(start.error)} 輸入已保留，可重試。
            </Text>
          ) : null}
          {saved ? (
            <Text accessibilityLiveRegion="polite" style={styles.body}>
              已記住：{saved.created.signal.title}
              {saved.interpretation === 'keyword_fallback' ? '（依關鍵字整理）' : ''}
            </Text>
          ) : null}
          {notice ? (
            <Text accessibilityRole="alert" style={styles.hint}>
              {notice}
            </Text>
          ) : null}
        </View>
        <Text style={styles.title}>
          {visible.length
            ? '分身找到這些機會'
            : busy
              ? '分身協調中'
              : active.length
                ? '還在替你留意合適的人'
                : '說完一句，就等分身帶消息回來'}
        </Text>
        {active.length ? (
          <View style={styles.watchStatus}>
            <MaterialCommunityIcons name="radar" size={18} color={colors.brown} />
            <Text style={styles.hint}>分身正在留意 · {active.length} 個需求</Text>
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/messages')}
          style={styles.chatLink}
        >
          <MaterialCommunityIcons name="message-outline" size={18} color={colors.brown} />
          <Text style={styles.hint}>已接受的機會，前往訊息查看</Text>
          <MaterialCommunityIcons name="chevron-right" size={18} color={colors.brown} />
        </Pressable>
        {!visible.length && active.length ? (
          <Text style={styles.body}>還沒遇到合適夥伴，稍後再來看看。</Text>
        ) : null}
        {matches.error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {coreError(matches.error)}
          </Text>
        ) : null}
        {(capability.data?.ready ? visible : []).map((match) => (
          <QuickMatch
            key={match.id}
            match={match}
            explanation={valid.get(match.id)?.explanations ?? []}
            refresh={refresh}
            onDecided={(id) => setDecided((ids) => [...ids, id])}
          />
        ))}
        {details && active.length ? (
          <PrimaryButton
            secondary
            disabled={busy || !capability.data?.ready}
            onPress={() => retry.mutate()}
          >
            {retry.isPending ? '分身再看看…' : '請分身再看看'}
          </PrimaryButton>
        ) : null}
        {retry.error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {coreError(retry.error)} 原本需求與結果仍保留。
          </Text>
        ) : null}
        <PrimaryButton secondary onPress={() => setDetails(!details)}>
          {details ? '收起我的需求' : '查看我的需求'}
        </PrimaryButton>
        {details ? (
          <View style={styles.card}>
            {saved?.sources.map((source) => (
              <Text key={source} style={styles.hint}>
                {source}
              </Text>
            ))}
            {active.map((signal) => (
              <View key={signal.id}>
                <Text style={styles.body}>{signal.title}</Text>
                <PrimaryButton
                  secondary
                  disabled={revoke.isPending}
                  onPress={() => revoke.mutate(signal.id)}
                >
                  不揪這個了
                </PrimaryButton>
              </View>
            ))}
            {revoke.error ? <Text style={styles.error}>{coreError(revoke.error)}</Text> : null}
          </View>
        ) : null}
        <PrimaryButton secondary onPress={onAdvanced}>
          分身與需求進階設定
        </PrimaryButton>
      </KeyboardScrollView>
    </Screen>
  );
}

export function QuickMatch({
  match,
  explanation,
  refresh,
  onDecided,
}: {
  match: StealthMatch;
  explanation: string[];
  refresh: () => Promise<void>;
  onDecided?: (id: string) => void;
}) {
  const actor = useAuthStore((s) => s.user?.id);
  const decide = useMutation({
    mutationFn: (decision: 'accepted' | 'declined') => stealthApi.decide(match.id, decision),
    onSuccess: async (result) => {
      if (useAuthStore.getState().user?.id !== actor) return;
      onDecided?.(match.id);
      await refresh();
      if (result.status === 'ready')
        router.push({ pathname: '/stealth-chat/[id]', params: { id: result.id } });
    },
  });
  return (
    <View style={styles.card}>
      <Text style={styles.subtitle}>
        {match.member_count} 人一起 ·{' '}
        {
          { drink: '喝飲料', meal: '吃正餐', pizza: '吃披薩', bakery: '買麵包', snack: '吃點心' }[
            match.category
          ]
        }
      </Text>
      <Text style={styles.body}>
        {(explanation.length ? explanation : match.reasons).slice(0, 2).join('。')}
      </Text>
      <View style={styles.watchStatus}>
        <MaterialCommunityIcons name="clock-outline" size={16} color={colors.brown} />
        <Text style={styles.hint}>
          {new Date(match.starts_at).toLocaleTimeString('zh-TW', {
            hour: '2-digit',
            minute: '2-digit',
          })}{' '}
          · {{ main_gate: '正門', east_gate: '麥側', south_gate: '莊九' }[match.location_id]}
        </Text>
        <Text style={styles.hint}>
          {match.known_cost_twd == null ? '金額待討論' : `約 NT$ ${match.known_cost_twd}／人`}
        </Text>
      </View>
      {match.status === 'formed' && match.formed_post_id ? (
        <PrimaryButton onPress={() => router.push(`/chat/${match.formed_post_id}`)}>
          進入成團聊天室
        </PrimaryButton>
      ) : match.is_demo ? (
        <Text style={styles.hint}>這是示範配對，沒有真人回覆。</Text>
      ) : match.status === 'ready' || match.coordination_opened ? (
        <PrimaryButton
          onPress={() => router.push({ pathname: '/stealth-chat/[id]', params: { id: match.id } })}
        >
          {match.status === 'unavailable' ? '查看聊天室紀錄' : '進聊天室聊細節'}
        </PrimaryButton>
      ) : match.my_decision === 'accepted' ? (
        <Text accessibilityLiveRegion="polite" style={styles.body}>
          你已同意聊聊，等待夥伴回覆。
        </Text>
      ) : (
        <PrimaryButton disabled={decide.isPending} onPress={() => decide.mutate('accepted')}>
          接受機會
        </PrimaryButton>
      )}
      {match.status !== 'formed' && match.status !== 'unavailable' && !match.is_demo ? (
        <PrimaryButton
          secondary
          disabled={decide.isPending}
          onPress={() => decide.mutate('declined')}
        >
          {match.my_decision === 'accepted' ? '撤回' : '這次先不用'}
        </PrimaryButton>
      ) : null}
      {decide.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {coreError(decide.error)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    padding: spacing.md,
    paddingBottom: 100,
    gap: spacing.md,
  },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  agentIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.yellowSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  watchStatus: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  chatLink: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  hero: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  title: { fontSize: 21, fontWeight: '800', lineHeight: 32, color: colors.ink },
  subtitle: { fontSize: 18, fontWeight: '700', color: colors.ink },
  body: { fontSize: 15, lineHeight: 24, color: colors.ink },
  hint: { fontSize: 13, lineHeight: 21, color: colors.muted },
  input: {
    backgroundColor: colors.surface,
    minHeight: 80,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.ink,
    fontSize: 16,
  },
  error: { color: colors.danger, lineHeight: 22 },
});
