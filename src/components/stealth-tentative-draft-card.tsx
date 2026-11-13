import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/app-text';
import { PrimaryButton } from '@/components/primitives';
import { displayTimestamp } from '@/lib/display-time';
import type { StealthAgentTermsDraft, StealthMatch } from '@/lib/stealth-api';
import { colors, radius, spacing, yellowSurface } from '@/theme/tokens';

const placeNames: Record<string, string> = {
  main_gate: '政大正門',
  east_gate: '政大東側門',
  south_gate: '政大南門',
};

function memberLabel(member: number | null, myMemberNumber: number): string {
  if (member == null) return '待確認';
  return `夥伴 ${member}${member === myMemberNumber ? '（我）' : ''}`;
}

/**
 * Shared tentative proposal card shown on match opportunity and inside coordination chat
 * before formal revision-1 terms are submitted.
 */
export function StealthTentativeDraftCard({
  match,
  draft,
  aiNotice,
  aiPending,
  proposePending,
  proposeError,
  canEdit,
  onPolishAi,
  onEdit,
  onPropose,
}: {
  match: StealthMatch;
  draft: StealthAgentTermsDraft;
  aiNotice?: string;
  aiPending?: boolean;
  proposePending?: boolean;
  proposeError?: string;
  canEdit?: boolean;
  onPolishAi?: () => void;
  onEdit?: () => void;
  onPropose?: () => void;
}) {
  const place = draft.location_label || placeNames[match.location_id] || match.location_id;
  const costText =
    draft.cost_per_person_twd != null
      ? `NT$ ${draft.cost_per_person_twd}／人`
      : draft.budget_limit_twd != null
        ? `待確認（預算上限 NT$ ${draft.budget_limit_twd}，非實際費用）`
        : '待確認';
  const confirmedFacts = draft.confirmed_facts?.length
    ? draft.confirmed_facts
    : [
        `共同地點：${place}`,
        draft.cost_per_person_twd != null
          ? `已提供每人費用：NT$ ${draft.cost_per_person_twd}`
          : draft.budget_limit_twd != null
            ? `已提供預算上限：NT$ ${draft.budget_limit_twd}（僅作預算參考，非實際費用）`
            : '每人費用尚未確認',
      ];
  const reasons = draft.recommendation_reasons?.length
    ? draft.recommendation_reasons
    : (match.highlights ?? []).slice(0, 3);
  const missingLabels = draft.missing_fields.map((f) =>
    f === 'cost' ? '實際費用' : f === 'order' ? '誰負責購買' : '誰負責取餐',
  );

  return (
    <View testID="tentative-draft-card" style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.pill}>
          <MaterialCommunityIcons name="file-document-edit-outline" size={14} color={colors.brown} />
          <Text style={styles.pillText}>共同暫定方案（待確認）</Text>
        </View>
        {draft.is_llm ? <Text style={styles.meta}>AI 整理</Text> : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>已由使用者明確提供的資訊</Text>
        {confirmedFacts.map((fact) => (
          <Text key={fact} style={styles.bullet}>
            • {fact}
          </Text>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>建議方案</Text>
        <Text style={styles.content}>{draft.content}</Text>
        <Text style={styles.rowText}>
          預計時間：{displayTimestamp(draft.starts_at ?? match.starts_at)}（截止{' '}
          {displayTimestamp(draft.deadline_at)}）
        </Text>
        <Text style={styles.rowText}>地點：{place}</Text>
        <Text style={styles.rowText}>每人費用：{costText}</Text>
        <Text style={styles.rowText}>
          誰負責購買：{memberLabel(draft.order_member, match.my_member_number)}
        </Text>
        <Text style={styles.rowText}>
          誰負責取餐：{memberLabel(draft.pickup_member, match.my_member_number)}
        </Text>
        {reasons.length ? (
          <View style={styles.reasonBox}>
            <Text style={styles.subLabel}>推薦理由</Text>
            {reasons.map((r) => (
              <Text key={r} style={styles.bullet}>
                • {r}
              </Text>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>尚待確認的事項</Text>
        {missingLabels.length ? (
          <Text style={styles.missing}>尚缺：{missingLabels.join('、')}（進聊天室後可補充）</Text>
        ) : null}
        {draft.needs_confirmation.slice(0, 3).map((item) => (
          <Text key={item} style={styles.hint}>
            • {item}
          </Text>
        ))}
      </View>

      {aiNotice ? <Text style={styles.notice}>{aiNotice}</Text> : null}
      {proposeError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {proposeError}
        </Text>
      ) : null}

      {canEdit ? (
        <View style={styles.actions}>
          {onPropose && draft.ready_to_submit ? (
            <PrimaryButton
              loading={proposePending}
              disabled={proposePending}
              onPress={onPropose}
            >
              提出此暫定方案（待雙方接受）
            </PrimaryButton>
          ) : null}
          {onEdit ? (
            <PrimaryButton secondary disabled={proposePending} onPress={onEdit}>
              {draft.ready_to_submit ? '修改後再提出' : '補充／修改方案'}
            </PrimaryButton>
          ) : null}
          {onPolishAi ? (
            <PrimaryButton
              secondary
              loading={aiPending}
              disabled={aiPending || proposePending}
              onPress={onPolishAi}
            >
              {aiPending ? '整理中...' : '用 AI 潤飾方案說明'}
            </PrimaryButton>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: '#E8CA54',
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    ...yellowSurface,
    backgroundColor: colors.yellowSoft,
  },
  pillText: { fontSize: 12, fontWeight: '700', color: colors.brown },
  meta: { fontSize: 11, color: colors.muted, fontWeight: '600' },
  section: { gap: 4, paddingTop: 4 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.ink },
  subLabel: { fontSize: 12, fontWeight: '700', color: colors.brown },
  reasonBox: { marginTop: 4, gap: 2 },
  content: { fontSize: 14, lineHeight: 21, color: colors.ink },
  rowText: { fontSize: 13, lineHeight: 20, color: colors.ink },
  bullet: { fontSize: 13, lineHeight: 20, color: colors.ink },
  missing: { fontSize: 13, lineHeight: 20, color: colors.brown, fontWeight: '600' },
  hint: { fontSize: 12, lineHeight: 19, color: colors.muted },
  notice: { fontSize: 12, lineHeight: 19, color: colors.brown },
  error: { fontSize: 12, lineHeight: 19, color: colors.danger },
  actions: { gap: spacing.sm, paddingTop: spacing.xs },
});
