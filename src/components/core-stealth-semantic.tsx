import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/app-text';
import { PrimaryButton } from '@/components/primitives';
import { coreError } from '@/lib/core-api';
import {
  stealthApi,
  type StealthMatch,
  type StealthSemanticItem,
  type StealthSemanticResult,
} from '@/lib/stealth-api';
import {
  eligibleSemanticMatch,
  pendingFactCodes,
  selectSemanticMatches,
  semanticReasonLabels,
} from '@/lib/stealth-semantic';
import { useAuthStore } from '@/store/auth-store';
import { colors, radius, spacing, yellowSurface } from '@/theme/tokens';

function StealthSemanticSession({
  matches,
  disabled,
  focused,
  refresh,
  now,
  renderMatch,
  actor,
}: {
  matches: StealthMatch[];
  disabled: boolean;
  focused: boolean;
  refresh: () => Promise<void>;
  now: () => number;
  renderMatch: (match: StealthMatch, semantic?: StealthSemanticItem) => ReactNode;
  actor?: string;
}) {
  const [analysis, setAnalysis] = useState<{ actor: string; result: StealthSemanticResult }>();
  const [previousFocus, setPreviousFocus] = useState(focused);
  if (previousFocus !== focused) {
    setPreviousFocus(focused);
    setAnalysis(undefined);
  }
  const [refreshFailed, setRefreshFailed] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    generation.current += 1;
  }, [focused]);
  const mounted = useRef(true);
  const discovery = useMutation({
    retry: false,
    gcTime: 0,
    mutationFn: async () => {
      const result = await stealthApi.discover();
      if (useAuthStore.getState().user?.id === actor) await refresh();
      return result;
    },
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const request = useMutation({
    retry: false,
    gcTime: 0,
    mutationFn: async (_scope: { actor: string; generation: number }) => stealthApi.semantic(),
    onSuccess: async (result, scope) => {
      if (
        !mounted.current ||
        generation.current !== scope.generation ||
        useAuthStore.getState().user?.id !== scope.actor
      )
        return;
      setAnalysis({ actor: scope.actor, result });
      try {
        await refresh();
      } catch {
        if (mounted.current) setRefreshFailed(true);
      }
    },
  });
  const result = focused && analysis && analysis.actor === actor ? analysis.result : undefined;
  const { ordered, valid, staleCount } = selectSemanticMatches(matches, result, now());
  const eligible = matches.some((match) => eligibleSemanticMatch(match, now()));
  return (
    <>
      <View style={styles.panel}>
        <Text style={styles.title}>讓分身看看誰能互相補足</Text>
        <Text style={styles.body}>
          依你的需求與已授權的配對摘要做語義排序，判讀前三組的互補理由與待確認事項。不會替你加入或同意方案。
        </Text>
        <PrimaryButton
          secondary
          loading={discovery.isPending}
          disabled={disabled || !actor || !focused || discovery.isPending || request.isPending}
          onPress={() => {
            setAnalysis(undefined);
            discovery.mutate();
          }}
        >
          {discovery.isPending ? '正在建立需求向量並搜尋' : 'AI 搜尋新配對機會'}
        </PrimaryButton>
        <Text style={styles.hint}>
          用你已儲存的有效需求搜尋新候選。對方也須建立需求向量；封鎖、預算與時間等限制照常檢查，不會自動成團。
        </Text>
        {discovery.data ? (
          <Text style={styles.body}>
            已建立 {discovery.data.indexed} 筆需求向量，新增 {discovery.data.created}{' '}
            組配對。若沒有結果，可請測試夥伴也按一次搜尋，再於30秒後重試。
          </Text>
        ) : null}
        {discovery.error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {coreError(discovery.error)}
          </Text>
        ) : null}
        <PrimaryButton
          loading={request.isPending}
          disabled={
            disabled || !actor || !focused || !eligible || request.isPending || discovery.isPending
          }
          onPress={() => {
            if (!actor) return;
            setAnalysis(undefined);
            setRefreshFailed(false);
            request.mutate({ actor, generation: generation.current });
          }}
        >
          {request.isPending ? '分身正在排序與判讀' : 'AI 語義排序與判讀'}
        </PrimaryButton>
        {!eligible ? (
          <Text style={styles.hint}>先建立需求並找到有效配對，再請分身分析。</Text>
        ) : null}
        {request.isPending ? (
          <Text accessibilityLiveRegion="polite" style={styles.hint}>
            本機模型可能需要一些時間，原有配對與確認流程仍可使用。
          </Text>
        ) : null}
        {request.error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {coreError(request.error)}
          </Text>
        ) : null}
        {result ? (
          <>
            <Text accessibilityLiveRegion="polite" style={styles.body}>
              {result.ranking.status === 'completed'
                ? '已完成語義排序；未判讀的其餘配對仍可查看。'
                : result.ranking.status === 'empty'
                  ? '目前沒有可分析的有效配對，請重新整理或尋找機會。'
                  : '本機語義模型暫時無法使用，保留原配對順序，沒有切換付費服務。'}
            </Text>
            {result.ranking.warnings.length ? (
              <Text style={styles.hint}>
                部分分析未完成或配對已變更。未通過檢查的判讀已隱藏，可稍後重新分析。
              </Text>
            ) : null}
            {staleCount ? (
              <Text accessibilityRole="alert" style={styles.hint}>
                配對條件、期限或確認狀態已更新，舊 AI 判讀已隱藏，請重新分析。
              </Text>
            ) : null}
            <PrimaryButton
              secondary
              disabled={request.isPending}
              onPress={() => {
                setAnalysis(undefined);
                request.reset();
              }}
            >
              回到原配對排序
            </PrimaryButton>
          </>
        ) : null}
        {refreshFailed ? (
          <Text accessibilityRole="alert" style={styles.hint}>
            配對重新整理未完成，請先重新整理資料；條件不一致的 AI 判讀不會顯示。
          </Text>
        ) : null}
        <Text style={styles.hint}>
          只分析你有權查看的摘要，不讀取他人的私人需求原文。相似度不是成團機率；費用與分工仍需全員確認同一版。
        </Text>
      </View>
      {ordered.map((match) => renderMatch(match, valid.get(match.id)))}
    </>
  );
}

export function StealthSemanticMatches(
  props: Omit<Parameters<typeof StealthSemanticSession>[0], 'actor'>,
) {
  const actor = useAuthStore((state) => state.user?.id);
  // Account changes clear private judgments. Foreground changes clear analysis
  // inside the session without remounting the editable formation cards.
  return <StealthSemanticSession key={actor} {...props} actor={actor} />;
}

export function StealthSemanticSummary({
  item,
  match,
}: {
  item: StealthSemanticItem;
  match: StealthMatch;
}) {
  const completed = item.review_status === 'completed' && !!item.review;
  const verdicts = {
    complementary: '有互補機會',
    similar: '需求相近，可再協調',
    uncertain: '資訊不足，仍需確認',
    not_recommended: '分身建議再評估這組',
  };
  const reasonCodes = completed ? item.review!.reason_codes : [];
  const positives = [
    ...new Set(
      reasonCodes
        .filter((c) => !pendingFactCodes.has(c))
        .map((c) => semanticReasonLabels[c])
        .filter(Boolean),
    ),
  ];
  const pending = [
    ...new Set([
      ...match.unknowns,
      ...reasonCodes
        .filter((c) => pendingFactCodes.has(c))
        .map((c) => semanticReasonLabels[c])
        .filter(Boolean),
    ]),
  ];
  return (
    <View testID={`stealth-semantic-${match.id}`} style={styles.panel}>
      <Text style={styles.title}>
        {completed
          ? `AI 判讀：${verdicts[item.review!.verdict]}`
          : item.review_status === 'unavailable'
            ? 'AI 候選判讀暫未完成'
            : '這組尚未進行 AI 候選判讀'}
      </Text>
      {item.similarity !== null && Number.isFinite(item.similarity) ? (
        <Text style={styles.hint}>語義相似度 {item.similarity.toFixed(3)}（不是成功率）</Text>
      ) : (
        <Text style={styles.hint}>語義相似度暫不可用，依原規則查看配對。</Text>
      )}
      <Text style={styles.label}>{completed ? 'AI 判讀理由' : '配對條件摘要'}</Text>
      {(completed ? positives : item.explanations).map((text) => (
        <Text key={text} style={styles.body}>
          • {text}
        </Text>
      ))}
      {pending.length ? (
        <>
          <Text style={styles.label}>待確認事項</Text>
          {pending.map((text) => (
            <Text key={text} style={styles.body}>
              • {text}
            </Text>
          ))}
        </>
      ) : null}
      <Text style={styles.hint}>
        以上是建議，尚未代表任何人同意。費用、分工及成團狀態以下方最新方案為準。
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radius.md,
    ...yellowSurface,
    backgroundColor: colors.yellowSoft,
  },
  title: { fontSize: 17, fontWeight: '700', color: colors.ink, lineHeight: 25 },
  label: { fontSize: 14, fontWeight: '700', color: colors.ink },
  body: { fontSize: 14, lineHeight: 23, color: colors.ink },
  hint: { fontSize: 13, lineHeight: 21, color: colors.muted },
  error: { color: colors.danger, lineHeight: 23 },
});
