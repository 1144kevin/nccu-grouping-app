import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/app-text';
import { KeyboardScrollView } from '@/components/keyboard-layout';
import { DetailHeader, IconButton, PrimaryButton, Screen } from '@/components/primitives';
import { InlineLoading } from '@/components/inline-loading';
import {
  StealthRequestSummary,
  stealthCategories,
  stealthLocations,
} from '@/components/stealth-request-summary';
import { coreError } from '@/lib/core-api';
import { useCoreScreenFocused } from '@/lib/core-hooks';
import { queryClient } from '@/lib/query-client';
import { stealthApi, type StealthMatch, type StealthSemanticResult } from '@/lib/stealth-api';
import { QuickStealthComposer } from '@/components/quick-stealth-composer';
import { selectSemanticMatches } from '@/lib/stealth-semantic';
import { useCoreClock } from '@/lib/core-clock';
import { useAuthStore } from '@/store/auth-store';
import { colors } from '@/theme/tokens';

export function QuickStealthScreen() {
  const actor = useAuthStore((s) => s.user?.id);
  return <QuickSession key={actor} actor={actor} />;
}

function QuickSession({ actor }: { actor?: string }) {
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
  const [composerBusy, setComposerBusy] = useState(false);
  const [analysis, setAnalysis] = useState<StealthSemanticResult>();
  const [notice, setNotice] = useState('');
  const [details, setDetails] = useState(false);
  const [localMatches, setLocalMatches] = useState<Record<string, StealthMatch>>({});
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: key });
  };
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
  const busy = composerBusy || retry.isPending;
  const now = clock.now();
  const active = (signals.data?.items ?? []).filter(
    (s) => s.status === 'active' && Date.parse(s.expires_at) > now,
  );
  const { ordered, valid } = selectSemanticMatches(
    matches.data?.items ?? [],
    focused ? analysis : undefined,
    now,
  );
  const visible = ordered
    .map((match) =>
      localMatches[match.id]?.my_decision === 'declined' &&
      ['pending', 'ready'].includes(match.status)
        ? localMatches[match.id]
        : match.my_decision === 'pending'
          ? (localMatches[match.id] ?? match)
          : match,
    )
    .filter(
      (m) =>
        ['pending', 'ready'].includes(m.status) &&
        m.my_decision !== 'declined' &&
        Date.parse(m.expires_at) > now,
    );
  return (
    <Screen>
      <DetailHeader
        title="偷揪"
        sideWidth={80}
        right={
          <View style={{ flexDirection: 'row' }}>
            <IconButton
              icon="message-outline"
              label="我的偷揪聊天"
              onPress={() => router.push('/messages')}
            />
            <IconButton
              icon="tune-variant"
              label="分身偏好"
              onPress={() => router.push('/stealth-preferences')}
            />
          </View>
        }
      />
      <KeyboardScrollView contentContainerStyle={styles.page}>
        <QuickStealthComposer
          actor={actor}
          enabled={!!agent.data?.enabled}
          focused={focused}
          disabled={
            !focused ||
            agent.isPending ||
            !!agent.error ||
            !capability.data?.ready ||
            capability.data?.conversation_configured === false ||
            retry.isPending
          }
          onBusyChange={setComposerBusy}
          onSaved={async (result) => {
            if (!sameActor()) return;
            setAnalysis(undefined);
            setNotice(
              result.created.matching === 'quiet'
                ? '需求已儲存，目前是分身的安靜時段。'
                : result.created.matching === 'unavailable'
                  ? '需求已儲存，配對暫時未完成，稍後可再找找。'
                  : '已開始找人，有合適的夥伴會顯示在下方。',
            );
            await refresh();
          }}
        />
        {agent.isPending || capability.isPending ? <InlineLoading label="正在載入需求" /> : null}
        {capability.data?.conversation_configured === false ? (
          <Text style={styles.error}>暫時無法聊天，請稍後再試。</Text>
        ) : null}
        {!capability.isPending && !capability.data?.ready ? (
          <Text style={styles.hint}>目前無法自動找人，請稍後再試。</Text>
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
        {notice ? (
          <Text accessibilityRole="alert" style={styles.hint}>
            {notice}
          </Text>
        ) : null}
        {active.length || visible.length ? (
          <View style={styles.sectionHeading}>
            <Text style={styles.title}>揪團進度</Text>
            <Text style={styles.hint}>{active.length} 個有效需求</Text>
          </View>
        ) : null}
        {active.length ? (
          <View style={styles.statusCard}>
            <View style={styles.statusIcon}>
              <MaterialCommunityIcons
                name={visible.length ? 'account-multiple-check-outline' : 'account-search-outline'}
                size={24}
                color={colors.brown}
              />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.statusTitle}>
                {visible.length
                  ? '有合適的夥伴，看看要不要聊聊'
                  : agent.data?.enabled
                    ? '正在留意合適的夥伴'
                    : '需求已保留，分身目前暫停'}
              </Text>
              <Text style={styles.hint}>
                可以先逛首頁，回來查看結果。所有夥伴都願意聊聊後，才會開啟聊天室。
              </Text>
            </View>
          </View>
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
            onUpdated={(result) => setLocalMatches((old) => ({ ...old, [result.id]: result }))}
          />
        ))}
        {active.length ? (
          <PrimaryButton
            secondary
            loading={retry.isPending}
            disabled={busy || !capability.data?.ready}
            onPress={() => retry.mutate()}
          >
            再找找看
          </PrimaryButton>
        ) : null}
        {retry.error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {coreError(retry.error)} 原本需求與結果仍保留。
          </Text>
        ) : null}
        {active.length ? (
          <>
            {(details ? active : active.slice(0, 1)).map((signal) => (
              <View key={signal.id} style={styles.card}>
                <Text style={styles.eyebrow}>這次幫你找</Text>
                <StealthRequestSummary signal={signal} />
                <PrimaryButton
                  secondary
                  loading={revoke.isPending && revoke.variables === signal.id}
                  disabled={revoke.isPending}
                  onPress={() => revoke.mutate(signal.id)}
                >
                  停止這個需求
                </PrimaryButton>
              </View>
            ))}
            {active.length > 1 ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setDetails(!details)}
                style={styles.chatLink}
              >
                <Text style={styles.hint}>
                  {details ? '收起其他需求' : `查看其他 ${active.length - 1} 個需求`}
                </Text>
              </Pressable>
            ) : null}
            {revoke.error ? <Text style={styles.error}>{coreError(revoke.error)}</Text> : null}
          </>
        ) : null}
      </KeyboardScrollView>
    </Screen>
  );
}

export function QuickMatch({
  match: snapshot,
  explanation,
  refresh,
  onDecided,
  onUpdated,
}: {
  match: StealthMatch;
  explanation: string[];
  refresh: () => Promise<void>;
  onDecided?: (id: string) => void;
  onUpdated?: (match: StealthMatch) => void;
}) {
  const actor = useAuthStore((s) => s.user?.id);
  const decide = useMutation({
    mutationFn: (decision: 'accepted' | 'declined') => stealthApi.decide(snapshot.id, decision),
    onSuccess: async (result) => {
      if (useAuthStore.getState().user?.id !== actor) return;
      onUpdated?.(result);
      if (result.my_decision === 'declined') onDecided?.(snapshot.id);
      await refresh();
      if (result.status === 'ready')
        router.push({ pathname: '/stealth-chat/[id]', params: { id: result.id } });
    },
  });
  const match = snapshot.my_decision === 'pending' ? (decide.data ?? snapshot) : snapshot;
  const waiting = match.my_decision === 'accepted' && match.status === 'pending';
  return (
    <View style={styles.card}>
      <View style={styles.matchHeading}>
        <View style={styles.people}>
          <View style={styles.person}>
            <MaterialCommunityIcons name="account-outline" size={24} color={colors.brown} />
          </View>
          <View style={[styles.person, styles.partner]}>
            <MaterialCommunityIcons name="account-heart-outline" size={24} color={colors.ink} />
          </View>
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.subtitle}>
            {match.member_count} 人一起 · {stealthCategories[match.category]}
          </Text>
          <Text style={styles.hint}>
            {waiting
              ? '等對方回覆'
              : match.status === 'ready'
                ? '夥伴都想聊聊'
                : '找到一個合適機會'}
          </Text>
        </View>
      </View>
      <Text style={styles.eyebrow}>可以一起揪的原因</Text>
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
          · {stealthLocations[match.location_id] ?? match.location_id}
        </Text>
        <Text style={styles.hint}>
          {match.known_cost_twd == null ? '實際費用待討論' : `已知 NT$ ${match.known_cost_twd}／人`}
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
          {match.status === 'unavailable' ? '查看聊天室紀錄' : '開始聊天'}
        </PrimaryButton>
      ) : match.my_decision === 'accepted' ? (
        <Text accessibilityLiveRegion="polite" style={styles.body}>
          你已表示有興趣，正在等對方回覆。這還不代表已加入正式拼單。
        </Text>
      ) : (
        <PrimaryButton
          loading={decide.isPending && decide.variables === 'accepted'}
          disabled={decide.isPending}
          onPress={() => decide.mutate('accepted')}
        >
          有興趣，先聊聊
        </PrimaryButton>
      )}
      {match.status !== 'formed' && match.status !== 'unavailable' && !match.is_demo ? (
        <PrimaryButton
          secondary
          loading={decide.isPending && decide.variables === 'declined'}
          disabled={decide.isPending}
          onPress={() => decide.mutate('declined')}
        >
          {match.my_decision === 'accepted' ? '撤回聊聊邀請' : '這次先不用'}
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
    padding: 20,
    paddingBottom: 32,
    flexGrow: 1,
    gap: 18,
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
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  title: { fontSize: 21, fontWeight: '800', lineHeight: 32, color: colors.ink },
  subtitle: { fontSize: 18, fontWeight: '700', color: colors.ink },
  body: { fontSize: 15, lineHeight: 24, color: colors.ink },
  hint: { fontSize: 13, lineHeight: 21, color: colors.muted },
  error: { color: colors.danger, lineHeight: 22 },
  eyebrow: { fontSize: 12, lineHeight: 19, fontWeight: '700', color: colors.muted },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  statusCard: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTitle: { fontSize: 15, lineHeight: 24, fontWeight: '700', color: colors.ink },
  matchHeading: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  people: { flexDirection: 'row', paddingRight: 6 },
  person: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0EEE9',
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partner: { backgroundColor: colors.yellowSoft, marginLeft: -12 },
  footnote: {
    fontSize: 12,
    lineHeight: 21,
    color: colors.muted,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
});
