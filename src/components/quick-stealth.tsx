import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText as Text } from '@/components/app-text';
import { KeyboardViewport, useKeyboardOpen } from '@/components/keyboard-layout';
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
import { StealthTentativeDraftCard } from '@/components/stealth-tentative-draft-card';
import { selectSemanticMatches } from '@/lib/stealth-semantic';
import { useCoreClock } from '@/lib/core-clock';
import { useAuthStore } from '@/store/auth-store';
import { colors, yellowSurface } from '@/theme/tokens';
import { displayTimestamp } from '@/lib/display-time';

const IGNORED_MATCH_REASONS = new Set([
  '取餐地點一致',
  '可用時間有交集',
  '餐點分類符合本人確認的選項',
  '需求內容的語義相近，細節仍需雙方確認',
  '透過需求向量搜尋找到，仍須本人確認',
  '方案預算上限採所有已提供上限中的最低值',
  '透過本人明確接受的替代類型形成互補方案',
]);

function isSystemBoilerplateReason(text: string): boolean {
  return (
    IGNORED_MATCH_REASONS.has(text) ||
    text.includes('向量搜尋') ||
    text.includes('語義相近') ||
    text.includes('仍須本人確認') ||
    text.includes('細節仍需雙方確認')
  );
}

function buildMatchSpecialSummary(match: StealthMatch, explanations: string[]): string {
  const parts: string[] = [];
  if (match.highlights?.length) {
    parts.push(...match.highlights.filter((h) => !isSystemBoilerplateReason(h)));
  }
  const suggestions = match.agent_draft?.role_suggestions ?? [];
  const pickupPartner = suggestions.find(
    (s) => s.role === 'pickup' && s.member_number != null && s.member_number !== match.my_member_number,
  );
  if (pickupPartner && !parts.some((p) => p.includes('取餐') || p.includes('跑這一趟'))) {
    parts.push('對方願意跑這一趟幫忙去買／取餐');
  }
  const orderPartner = suggestions.find(
    (s) => s.role === 'order' && s.member_number != null && s.member_number !== match.my_member_number,
  );
  if (orderPartner && !parts.some((p) => p.includes('下單'))) {
    parts.push('對方願意負責下單與付款協調');
  }
  for (const reason of [...match.reasons, ...explanations]) {
    if (isSystemBoilerplateReason(reason)) continue;
    if (/優惠|折價|省|多付|手續費|跑腿|順路|好市多|Costco|全聯|家樂福|外送|分享/i.test(reason)) {
      if (!parts.includes(reason)) parts.push(reason);
    }
  }
  if (
    match.known_cost_twd != null &&
    match.budget_max_twd != null &&
    match.known_cost_twd <= match.budget_max_twd
  ) {
    parts.push(`每人預計 NT$ ${match.known_cost_twd}（符合你的預算上限）`);
  }
  if (!parts.length) {
    const loc = stealthLocations[match.location_id] ?? match.location_id;
    parts.push(
      `對方今天剛好想在「${loc}」一起湊${stealthCategories[match.category] ?? '同類需求'}，時間與條件互補`,
    );
  }
  return parts.slice(0, 3).join('；');
}

export function QuickStealthScreen() {
  const actor = useAuthStore((s) => s.user?.id);
  return <QuickSession key={actor} actor={actor} />;
}

function QuickSession({ actor }: { actor?: string }) {
  const focused = useCoreScreenFocused();
  const insets = useSafeAreaInsets();
  const keyboardOpen = useKeyboardOpen();
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
  const [localMatches, setLocalMatches] = useState<Record<string, StealthMatch>>({});
  const [dismissedFormedIds, setDismissedFormedIds] = useState<string[]>([]);
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
  const activeSignal = active[0];
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
  const shownMatches = [
    ...visible.filter((m) => m.status === 'ready' || m.my_decision === 'accepted'),
    ...visible.filter((m) => m.status === 'pending' && m.my_decision === 'pending').slice(0, 1),
  ];
  const allMatches = matches.data?.items ?? [];
  const formedMatch = allMatches.find((m) => {
    if (m.status !== 'formed' || dismissedFormedIds.includes(m.id)) return false;
    const matchTime = Date.parse(m.formed_at ?? m.created_at);
    if (activeSignal) {
      return Number.isFinite(matchTime) && matchTime >= Date.parse(activeSignal.created_at);
    }
    return Number.isFinite(matchTime) && matchTime > now - 24 * 60 * 60 * 1000;
  });
  const readyMatch = allMatches.find(
    (m) => m.status === 'ready' && m.my_decision !== 'declined' && Date.parse(m.expires_at) > now,
  );
  const pendingMatch = visible.find((m) => m.status === 'pending');
  const progressStage: 0 | 1 | 2 | 3 | 4 = activeSignal
    ? readyMatch
      ? 3
      : pendingMatch
        ? 2
        : formedMatch
          ? 4
          : 1
    : formedMatch
      ? 4
      : 0;
  const chatStreamExtra = (
    <View style={{ gap: 12 }}>
      {agent.isPending || capability.isPending ? <InlineLoading label="正在載入需求" /> : null}
      {capability.data?.conversation_configured === false ? (
        <View style={styles.systemBubble}>
          <Text style={styles.error}>暫時無法聊天，請稍後再試。</Text>
        </View>
      ) : null}
      {!capability.isPending && !capability.data?.ready ? (
        <View style={styles.systemBubble}>
          <Text style={styles.hint}>目前無法自動找人，請稍後再試。</Text>
        </View>
      ) : null}
      {agent.error ? (
        <View style={styles.systemBubble}>
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
        </View>
      ) : null}
      {notice ? (
        <View style={styles.systemBubble}>
          <Text accessibilityRole="alert" style={styles.body}>
            {notice}
          </Text>
        </View>
      ) : null}
      {activeSignal ? (
        <View style={styles.inChatCardWrap}>
          <View style={styles.systemBubble}>
            <Text style={styles.body}>
              目前已使用這張偷揪單等待配對中（保留 24 小時）。同時最多只能有一張偷揪單，若覺得這張單不行或想重開新單，請先點選卡片右上角取消：
            </Text>
          </View>
          <StealthRequestSummary
            compact
            signal={activeSignal}
            createdAt={activeSignal.created_at}
            onClose={() => revoke.mutate(activeSignal.id)}
            closing={revoke.isPending && revoke.variables === activeSignal.id}
            closeDisabled={revoke.isPending}
          />
          {revoke.error ? <Text style={styles.error}>{coreError(revoke.error)}</Text> : null}
        </View>
      ) : null}
      {matches.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {coreError(matches.error)}
        </Text>
      ) : null}
      {(capability.data?.ready ? shownMatches : []).map((match) => {
        const explanations = valid.get(match.id)?.explanations ?? [];
        const specialSummary = buildMatchSpecialSummary(match, explanations);
        return (
          <View key={match.id} style={styles.inChatCardWrap}>
            <View style={styles.systemBubble}>
              <Text style={styles.body}>
                🎉 現在有一個配對機會，請問是否要接受？{'\n'}✨ 這次配對特別之處：{specialSummary}
              </Text>
            </View>
            <QuickMatch
              match={match}
              explanation={explanations}
              refresh={refresh}
              onUpdated={(result) => setLocalMatches((old) => ({ ...old, [result.id]: result }))}
            />
          </View>
        );
      })}
      {activeSignal && progressStage < 3 ? (
        <View style={{ alignSelf: 'flex-start' }}>
          <PrimaryButton
            secondary
            loading={retry.isPending}
            disabled={busy || !capability.data?.ready}
            onPress={() => retry.mutate()}
          >
            再找找看
          </PrimaryButton>
        </View>
      ) : null}
      {retry.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {coreError(retry.error)} 原本需求與結果仍保留。
        </Text>
      ) : null}
    </View>
  );
  return (
    <Screen pinKeyboardHeader>
      <DetailHeader
        title="偷揪"
        sideWidth={80}
        right={
          <View style={{ flexDirection: 'row' }}>
            <IconButton
              icon="history"
              label="偷揪紀錄"
              onPress={() => router.push('/stealth-history' as never)}
            />
            <IconButton
              icon="tune-variant"
              label="分身偏好"
              onPress={() => router.push('/stealth-preferences')}
            />
          </View>
        }
      />
      <KeyboardViewport>
        <View
          style={[
            styles.page,
            { paddingBottom: keyboardOpen ? 8 : Math.max(8, insets.bottom) },
          ]}
        >
          <QuickStealthComposer
            actor={actor}
            enabled={!!agent.data?.enabled}
            hasActiveSignal={active.length >= 1}
            activeSignal={activeSignal}
            progressStage={progressStage}
            cancelling={revoke.isPending}
            onRefresh={refresh}
            onCancelActiveSignal={async () => {
              if (!activeSignal) return;
              await revoke.mutateAsync(activeSignal.id);
            }}
            onRestartStealth={async () => {
              if (activeSignal) await revoke.mutateAsync(activeSignal.id);
              if (formedMatch) {
                setDismissedFormedIds((old) =>
                  old.includes(formedMatch.id) ? old : [...old, formedMatch.id],
                );
              }
              setAnalysis(undefined);
              setNotice('');
              setLocalMatches({});
              await refresh();
            }}
            chatStreamExtra={chatStreamExtra}
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
                    : '',
              );
              await refresh();
            }}
          />
        </View>
      </KeyboardViewport>
    </Screen>
  );
}

export function QuickMatch({
  match: snapshot,
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
            <MaterialCommunityIcons name="account-outline" size={24} color={colors.ink} />
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
      <View style={styles.watchStatus}>
        <MaterialCommunityIcons name="clock-outline" size={16} color={colors.brown} />
        {match.semantic_proposal ? <Text style={styles.hint}>時間、地點待確認</Text> : null}
        <Text style={styles.hint}>
          {displayTimestamp(match.starts_at)} ·{' '}
          {stealthLocations[match.location_id] ?? match.location_id}
        </Text>
        <Text style={styles.hint}>
          {match.known_cost_twd == null ? '實際費用待討論' : `已知 NT$ ${match.known_cost_twd}／人`}
        </Text>
      </View>
      {match.agent_draft && !match.terms && match.status !== 'formed' && match.status !== 'unavailable' ? (
        <StealthTentativeDraftCard match={match} draft={match.agent_draft} />
      ) : null}
      {match.status === 'formed' ? (
        <PrimaryButton
          onPress={() => router.push({ pathname: '/stealth-chat/[id]', params: { id: match.id } })}
        >
          進入成團聊天室
        </PrimaryButton>
      ) : match.is_demo ? (
        <Text style={styles.hint}>這是示範配對，沒有真人回覆。</Text>
      ) : match.status === 'ready' || match.coordination_opened ? (
        <PrimaryButton
          onPress={() => router.push({ pathname: '/stealth-chat/[id]', params: { id: match.id } })}
        >
          {match.status === 'unavailable' ? '查看聊天室紀錄' : '進入偷揪聊天室'}
        </PrimaryButton>
      ) : match.my_decision === 'accepted' ? (
        <Text accessibilityLiveRegion="polite" style={styles.body}>
          你已表示有興趣，等待夥伴回覆
        </Text>
      ) : (
        <>
          <PrimaryButton
            loading={decide.isPending && decide.variables === 'accepted'}
            disabled={decide.isPending}
            onPress={() => decide.mutate('accepted')}
          >
            有興趣，先聊聊
          </PrimaryButton>
          <Text style={styles.hint}>同意聊聊僅先進入聊天室確認，不會直接同意成立拼單。</Text>
        </>
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
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  inChatCardWrap: {
    alignSelf: 'flex-start',
    width: '100%',
    maxWidth: 350,
    gap: 8,
  },
  systemBubble: {
    alignSelf: 'flex-start',
    maxWidth: '94%',
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderTopLeftRadius: 4,
    padding: 12,
    gap: 6,
  },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  agentIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    ...yellowSurface,
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
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partner: { ...yellowSurface, backgroundColor: colors.yellowSoft, marginLeft: -12 },
  footnote: {
    fontSize: 12,
    lineHeight: 21,
    color: colors.muted,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
});
