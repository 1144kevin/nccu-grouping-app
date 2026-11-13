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

function InfoRow({
  icon,
  text,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  text: string;
}) {
  return (
    <View style={styles.infoRow}>
      <MaterialCommunityIcons name={icon} size={16} color={colors.muted} />
      <Text style={styles.rowText}>{text}</Text>
    </View>
  );
}

/**
 * Compact tentative proposal card (推薦理由 + 建議方案 with icons) shown on match opportunity
 * and inside the collapsible LINE-style announcement drawer in coordination chat.
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
  const reasons = draft.recommendation_reasons?.length
    ? draft.recommendation_reasons
    : (match.highlights ?? []).slice(0, 3);
  const roleSummary = `買：${memberLabel(draft.order_member, match.my_member_number)} · 取：${memberLabel(draft.pickup_member, match.my_member_number)}`;
  const showPropose = Boolean(onPropose && draft.ready_to_submit);
  const showPolish = Boolean(!showPropose && onPolishAi);

  return (
    <View testID="tentative-draft-card" style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.pill}>
          <MaterialCommunityIcons name="file-document-edit-outline" size={14} color={colors.brown} />
          <Text style={styles.pillText}>共同暫定方案</Text>
        </View>
        {draft.is_llm ? <Text style={styles.meta}>AI 整理</Text> : null}
      </View>

      {reasons.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>推薦理由</Text>
          {reasons.map((r) => (
            <Text key={r} style={styles.reasonText}>
              • {r}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>建議方案</Text>
        <Text style={styles.content}>{draft.content}</Text>
        <InfoRow
          icon="clock-outline"
          text={`${displayTimestamp(draft.starts_at ?? match.starts_at)}（截止 ${displayTimestamp(draft.deadline_at)}）`}
        />
        <InfoRow icon="map-marker-outline" text={place} />
        <InfoRow icon="cash-multiple" text={costText} />
        <InfoRow icon="account-outline" text={roleSummary} />
      </View>

      {aiNotice ? <Text style={styles.notice}>{aiNotice}</Text> : null}
      {proposeError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {proposeError}
        </Text>
      ) : null}

      {canEdit && (onEdit || showPropose || showPolish) ? (
        <View style={styles.actions}>
          {onEdit ? (
            <PrimaryButton
              secondary
              disabled={proposePending}
              onPress={onEdit}
              style={styles.actionButton}
            >
              修改／補充
            </PrimaryButton>
          ) : null}
          {showPropose ? (
            <PrimaryButton
              loading={proposePending}
              disabled={proposePending}
              onPress={onPropose}
              style={styles.actionButton}
            >
              提出方案
            </PrimaryButton>
          ) : showPolish ? (
            <PrimaryButton
              secondary
              loading={aiPending}
              disabled={aiPending || proposePending}
              onPress={onPolishAi}
              style={styles.actionButton}
            >
              {aiPending ? '整理中...' : 'AI 潤飾'}
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
  section: { gap: 4, paddingTop: 2 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.ink },
  reasonText: { fontSize: 13, lineHeight: 19, color: colors.brown },
  content: { fontSize: 14, lineHeight: 20, color: colors.ink, marginBottom: 2 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowText: { flex: 1, fontSize: 13, lineHeight: 19, color: colors.ink },
  notice: { fontSize: 12, lineHeight: 18, color: colors.brown },
  error: { fontSize: 12, lineHeight: 18, color: colors.danger },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  actionButton: {
    minHeight: 38,
    paddingHorizontal: spacing.md,
  },
});
