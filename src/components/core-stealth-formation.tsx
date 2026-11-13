import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '@/components/app-text';
import { DeadlinePickerModal, formatDeadline, startOfDay } from '@/components/deadline-picker';
import { PrimaryButton, SectionTitle } from '@/components/primitives';
import { coreError } from '@/lib/core-api';
import { stealthApi, type StealthMatch } from '@/lib/stealth-api';
import { colors, radius, spacing, typography, yellowSurface } from '@/theme/tokens';

function FieldRow({
  icon,
  title,
  children,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.fieldRow}>
      <View style={styles.fieldLabelRow}>
        <MaterialCommunityIcons name={icon} size={18} color={colors.muted} />
        <Text style={styles.fieldTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

/**
 * Formal proposal composer matching PostComposer's clean field layout,
 * pre-filled from existing match terms or the tentative AI/rule draft.
 */
export function StealthFormation({
  match,
  now,
  refresh,
  onSubmitted,
}: {
  match: StealthMatch;
  now?: () => number;
  refresh: () => Promise<void>;
  onSubmitted?: () => void;
}) {
  const initialDraft = match.terms ?? match.agent_draft;
  const [revision, setRevision] = useState(match.terms_revision);
  const [content, setContent] = useState(initialDraft?.content ?? '');
  const [cost, setCost] = useState(
    initialDraft?.cost_per_person_twd != null ? String(initialDraft.cost_per_person_twd) : '',
  );
  const [deadline, setDeadline] = useState(initialDraft?.deadline_at ?? match.ends_at);
  const [order, setOrder] = useState<number>(initialDraft?.order_member ?? 0);
  const [pickup, setPickup] = useState<number>(initialDraft?.pickup_member ?? 0);
  const [deadlineVisible, setDeadlineVisible] = useState(false);
  const [draftDeadline, setDraftDeadline] = useState(() => new Date(deadline));
  const [deadlineError, setDeadlineError] = useState('');

  const stale = revision !== match.terms_revision;
  const amount = Number(cost);
  const valid =
    content.trim().length >= 5 &&
    Number.isInteger(amount) &&
    amount >= 0 &&
    order > 0 &&
    pickup > 0;

  const save = useMutation({
    mutationFn: () =>
      stealthApi.terms(match.id, revision, {
        content: content.trim(),
        cost_per_person_twd: amount,
        deadline_at: new Date(deadline).toISOString(),
        order_member: order,
        pickup_member: pickup,
      }),
    onSuccess: async () => {
      await refresh();
      onSubmitted?.();
    },
  });

  const members = Array.from({ length: match.member_count }, (_, i) => i + 1);
  const label = (n: number) => `夥伴 ${n}${n === match.my_member_number ? '（我）' : ''}`;

  return (
    <View style={styles.panel}>
      {stale ? (
        <View style={styles.staleBanner}>
          <Text accessibilityRole="alert" style={styles.error}>
            方案已有更新，請先重新載入。
          </Text>
          <PrimaryButton
            secondary
            onPress={() => {
              setRevision(match.terms_revision);
              setContent(match.terms?.content ?? '');
              setCost(String(match.terms?.cost_per_person_twd ?? ''));
              setDeadline(match.terms?.deadline_at ?? match.ends_at);
              setOrder(match.terms?.order_member ?? 0);
              setPickup(match.terms?.pickup_member ?? 0);
            }}
          >
            載入最新方案
          </PrimaryButton>
        </View>
      ) : null}

      <SectionTitle>拼單內容</SectionTitle>
      <TextInput
        accessibilityLabel="成團公開說明"
        value={content}
        onChangeText={setContent}
        maxLength={300}
        multiline
        placeholder="分享想揪的餐點、價格、取餐地點等資訊..."
        placeholderTextColor={colors.subtle}
        textAlignVertical="top"
        style={styles.editor}
      />
      <View style={styles.counterRow}>
        <Text style={styles.fieldHint}>提出後需所有夥伴接受同一版本才會正式成立。</Text>
        <Text style={styles.counter}>{content.trim().length}/300</Text>
      </View>

      <SectionTitle>拼單設定</SectionTitle>
      <FieldRow icon="cash" title="每人費用">
        <View style={styles.settingControl}>
          <Text style={styles.currency}>NT$</Text>
          <TextInput
            accessibilityLabel="成團每人費用"
            value={cost}
            onChangeText={setCost}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="請輸入每人金額"
            placeholderTextColor={colors.subtle}
            style={styles.priceInput}
          />
          <Text style={styles.currency}>／人</Text>
        </View>
      </FieldRow>

      <FieldRow icon="clock-outline" title="截止時間">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="選擇截止時間"
          disabled={!now}
          onPress={() => {
            setDraftDeadline(new Date(deadline));
            setDeadlineVisible(true);
          }}
          style={styles.settingControl}
        >
          <Text style={styles.controlValue}>{formatDeadline(new Date(deadline))}</Text>
          <MaterialCommunityIcons name="chevron-right" size={17} color={colors.muted} />
        </Pressable>
      </FieldRow>

      <FieldRow icon="cart-outline" title="誰負責購買">
        <View style={styles.chipRow}>
          {members.map((n) => {
            const selected = order === n;
            return (
              <Pressable
                key={n}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setOrder(n)}
                style={[styles.chip, selected && styles.chipSelected]}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {label(n)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </FieldRow>

      <FieldRow icon="walk" title="誰負責取餐">
        <View style={styles.chipRow}>
          {members.map((n) => {
            const selected = pickup === n;
            return (
              <Pressable
                key={n}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setPickup(n)}
                style={[styles.chip, selected && styles.chipSelected]}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {label(n)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </FieldRow>

      {deadlineError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {deadlineError}
        </Text>
      ) : null}
      {save.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {coreError(save.error)}
        </Text>
      ) : null}

      <PrimaryButton
        disabled={!valid || stale || save.isPending}
        loading={save.isPending}
        onPress={() => save.mutate()}
        style={styles.submitButton}
      >
        提出方案
      </PrimaryButton>

      <DeadlinePickerModal
        startDate={startOfDay(now?.() ?? Date.now())}
        value={draftDeadline}
        visible={deadlineVisible}
        onChange={setDraftDeadline}
        onClose={() => setDeadlineVisible(false)}
        onApply={() => {
          if (
            !now ||
            draftDeadline.getTime() <= now() ||
            draftDeadline.getTime() > now() + 14 * 86400000
          ) {
            setDeadlineError('時間請選擇未來 14 天內。');
            return;
          }
          setDeadline(draftDeadline.toISOString());
          setDeadlineVisible(false);
          setDeadlineError('');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  staleBanner: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: colors.danger,
    gap: spacing.sm,
  },
  editor: {
    minHeight: 130,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontFamily: typography.regular,
    fontSize: 16,
    lineHeight: 24,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  fieldHint: { flex: 1, color: colors.muted, fontSize: 12 },
  counter: { color: colors.muted, fontSize: 12 },
  fieldRow: { gap: spacing.xs },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fieldTitle: { fontSize: 14, fontWeight: '600', color: colors.ink },
  settingControl: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  controlValue: { flex: 1, color: colors.ink, fontSize: 15 },
  currency: { fontSize: 14, color: colors.muted },
  priceInput: { flex: 1, minWidth: 0, minHeight: 42, color: colors.ink, fontSize: 15 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: 38,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    borderColor: colors.yellow,
    ...yellowSurface,
    backgroundColor: colors.yellowSoft,
  },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.muted },
  chipTextSelected: { color: colors.brown },
  error: { color: colors.danger, fontSize: 13 },
  submitButton: { marginTop: spacing.xs },
});
