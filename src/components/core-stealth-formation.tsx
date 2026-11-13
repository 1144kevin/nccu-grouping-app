import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '@/components/app-text';
import { PrimaryButton } from '@/components/primitives';
import { DeadlinePickerModal, formatDeadline, startOfDay } from '@/components/deadline-picker';
import { coreError } from '@/lib/core-api';
import { stealthApi, type StealthMatch } from '@/lib/stealth-api';
import { colors, radius, spacing } from '@/theme/tokens';

export function StealthFormation({ match, refresh, now, onSubmitted }: {
  match: StealthMatch; refresh: () => Promise<void>; now?: () => number; onSubmitted?: () => void;
}) {
  const [revision, setRevision] = useState(match.terms_revision);
  const [content, setContent] = useState(match.terms?.content ?? match.agent_draft?.content ?? '');
  const [cost, setCost] = useState(
    String(match.terms?.cost_per_person_twd ?? match.agent_draft?.cost_per_person_twd ?? ''),
  );
  const [deadline, setDeadline] = useState(
    match.terms?.deadline_at ?? match.agent_draft?.deadline_at ?? match.ends_at,
  );
  const [draftDeadline, setDraftDeadline] = useState(new Date(deadline));
  const [deadlineVisible, setDeadlineVisible] = useState(false);
  const [deadlineError, setDeadlineError] = useState('');
  const [order, setOrder] = useState(
    match.terms?.order_member ?? match.agent_draft?.order_member ?? 0,
  );
  const [pickup, setPickup] = useState(
    match.terms?.pickup_member ?? match.agent_draft?.pickup_member ?? 0,
  );
  const stale = revision !== match.terms_revision;
  const save = useMutation({
    mutationFn: () => stealthApi.terms(match.id, revision, {
      content: content.trim(), cost_per_person_twd: Number(cost), deadline_at: new Date(deadline).toISOString(),
      order_member: order, pickup_member: pickup,
    }),
    onSuccess: async () => { try { await refresh(); } finally { onSubmitted?.(); } },
    onError: () => { void refresh(); },
  });
  const members = Array.from({ length: match.member_count }, (_, index) => index + 1);
  const label = (member: number) => `夥伴 ${member}${member === match.my_member_number ? '（我）' : ''}`;
  const valid = content.trim().length >= 10 && content.trim().length <= 300 && /^\d+$/.test(cost)
    && Number(cost) <= 100000 && Number.isFinite(Date.parse(deadline)) && !!now
    && Date.parse(deadline) > now() && Date.parse(deadline) <= now() + 14 * 86400000
    && members.includes(order) && members.includes(pickup);
  return <View style={styles.panel}>
    <Text style={styles.heading}>填寫拼單</Text>
    {stale ? <><Text accessibilityRole="alert" style={styles.error}>方案已有更新，請先重新載入。</Text>
      <PrimaryButton secondary onPress={() => { setRevision(match.terms_revision); setContent(match.terms?.content ?? ''); setCost(String(match.terms?.cost_per_person_twd ?? '')); setDeadline(match.terms?.deadline_at ?? match.ends_at); setOrder(match.terms?.order_member ?? 0); setPickup(match.terms?.pickup_member ?? 0); }}>載入最新方案</PrimaryButton></> : null}
    <Text>方案內容</Text><TextInput accessibilityLabel="成團公開說明" value={content} onChangeText={setContent} maxLength={300} multiline style={styles.input} />
    <Text>每人費用</Text><TextInput accessibilityLabel="成團每人費用" value={cost} onChangeText={setCost} keyboardType="number-pad" maxLength={6} style={styles.input} />
    <Text>時間</Text><PrimaryButton secondary disabled={!now} onPress={() => { setDraftDeadline(new Date(deadline)); setDeadlineVisible(true); }}>{formatDeadline(new Date(deadline))}</PrimaryButton>
    <Text>誰買</Text><View style={styles.row}>{members.map((n) => <PrimaryButton key={n} secondary={order !== n} onPress={() => setOrder(n)}>{label(n)}</PrimaryButton>)}</View>
    <Text>誰取</Text><View style={styles.row}>{members.map((n) => <PrimaryButton key={n} secondary={pickup !== n} onPress={() => setPickup(n)}>{label(n)}</PrimaryButton>)}</View>
    {deadlineError ? <Text accessibilityRole="alert" style={styles.error}>{deadlineError}</Text> : null}
    {save.error ? <Text accessibilityRole="alert" style={styles.error}>{coreError(save.error)}</Text> : null}
    <PrimaryButton disabled={!valid || stale || save.isPending} loading={save.isPending} onPress={() => save.mutate()}>提出方案</PrimaryButton>
    <DeadlinePickerModal startDate={startOfDay(now?.() ?? Date.now())} value={draftDeadline} visible={deadlineVisible} onChange={setDraftDeadline} onClose={() => setDeadlineVisible(false)} onApply={() => {
      if (!now || draftDeadline.getTime() <= now() || draftDeadline.getTime() > now() + 14 * 86400000) { setDeadlineError('時間請選擇未來 14 天內。'); return; }
      setDeadline(draftDeadline.toISOString()); setDeadlineVisible(false); setDeadlineError('');
    }} />
  </View>;
}
const styles = StyleSheet.create({
  panel: { gap: spacing.md, padding: spacing.md, backgroundColor: colors.background },
  heading: { fontSize: 18, fontWeight: '700', color: colors.ink },
  input: { padding: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.background, minHeight: 44, color: colors.ink },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  error: { color: colors.danger },
});
