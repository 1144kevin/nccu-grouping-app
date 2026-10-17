import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '@/components/app-text';
import { PrimaryButton } from '@/components/primitives';
import { DeadlinePickerModal, formatDeadline, startOfDay } from '@/components/deadline-picker';
import { coreError } from '@/lib/core-api';
import { stealthApi, type StealthAgentTermsDraft, type StealthMatch } from '@/lib/stealth-api';
import { colors, radius, spacing } from '@/theme/tokens';

export function StealthFormation({ match, refresh, now }: { match: StealthMatch; refresh: () => Promise<void>; now?: () => number }) {
  const [editing, setEditing] = useState(false);
  const [checked, setChecked] = useState(false);
  const [content, setContent] = useState(match.terms?.content ?? match.agent_draft?.content ?? '偷揪夥伴一起分享餐點，依下列費用與分工協調。');
  const [cost, setCost] = useState(String(match.terms?.cost_per_person_twd ?? match.agent_draft?.cost_per_person_twd ?? match.known_cost_twd ?? ''));
  const [costNote, setCostNote] = useState(match.terms?.cost_change_note ?? '');
  const [deadline, setDeadline] = useState(match.terms?.deadline_at ?? match.agent_draft?.deadline_at ?? match.ends_at);
  const [draftDeadline, setDraftDeadline] = useState(new Date(deadline));
  const [deadlineVisible, setDeadlineVisible] = useState(false);
  const [deadlineStart, setDeadlineStart] = useState(() => startOfDay(Date.parse(match.created_at)));
  const [deadlineError, setDeadlineError] = useState('');
  const [order, setOrder] = useState(match.terms?.order_member ?? (match.agent_draft ? match.agent_draft.order_member ?? 0 : match.my_member_number));
  const [pickup, setPickup] = useState(match.terms?.pickup_member ?? (match.agent_draft ? match.agent_draft.pickup_member ?? 0 : match.my_member_number));
  const save = useMutation({ mutationFn: () => stealthApi.terms(match.id, match.terms_revision, { content: content.trim(), cost_per_person_twd: Number(cost), cost_change_note: costNote.trim(), deadline_at: new Date(deadline).toISOString(), order_member: order, pickup_member: pickup }), onSuccess: () => { setEditing(false); setChecked(false); }, onSettled: refresh });
  const consent = useMutation({ mutationFn: () => stealthApi.consent(match.id, match.terms_revision), onSettled: refresh });
  const busy = save.isPending || consent.isPending;
  const error = save.error ?? consent.error;
  const label = (member: number) => `成員 ${member}${member === match.my_member_number ? '（我）' : ''}`;
  const members = Array.from({ length: match.member_count }, (_, i) => i + 1);
  const costChanged = match.known_cost_twd != null && /^\d+$/.test(cost) && Number(cost) !== match.known_cost_twd;
  const overBudget = match.budget_max_twd != null && /^\d+$/.test(cost) && Number(cost) > match.budget_max_twd;
  const valid = content.trim().length >= 10 && content.trim().length <= 300 && /^\d+$/.test(cost) && Number(cost) <= 100000 && Number.isFinite(Date.parse(deadline)) && members.includes(order) && members.includes(pickup) && (!costChanged || costNote.trim().length >= 5) && !overBudget;
  if (match.status === 'formed' && match.formed_post_id) return <View style={styles.panel}>
    <Text style={styles.heading}>全員已同意，拼單與聊天室已建立</Text>
    {match.terms ? <Text style={styles.body}>第 {match.terms_revision} 版 · 每人 NT$ {match.terms.cost_per_person_twd} · 已同意 {match.confirmed_count}／{match.member_count} 人</Text> : null}
    {match.terms?.cost_change_note ? <Text style={styles.body}>本組費用調整原因：{match.terms.cost_change_note}</Text> : null}
    <Text style={styles.body}>本次需求已使用，其他重疊配對會失效。後續退出、名額與取消依原本拼單流程處理；此處不會重複建團。</Text>
    <PrimaryButton onPress={() => router.push({ pathname: '/order/[id]', params: { id: match.formed_post_id! } })}>查看正式拼單</PrimaryButton>
    <PrimaryButton secondary onPress={() => router.push({ pathname: '/chat/[id]', params: { id: match.formed_post_id! } })}>進入成團聊天室</PrimaryButton>
  </View>;
  if (match.is_demo) return <View style={styles.panel}>{match.agent_draft ? <AgentDraftSummary draft={match.agent_draft} /> : null}<Text style={styles.body}>示範人物無法提供真人同意，因此這組不能建立正式拼單。請用兩個真實測試帳號體驗成團。</Text></View>;
  if (match.status === 'unavailable') return null;
  return <View style={styles.panel}>
    {match.agent_draft && (!match.terms || editing) ? <AgentDraftSummary draft={match.agent_draft} /> : null}
    <Text style={styles.heading}>確認最終方案</Text>
    <Text style={styles.body}>你是{label(match.my_member_number)}。成團前使用固定代號；提案者擔任主揪。分配角色只是提案，必須本人同意才算承諾。</Text>
    {match.terms ? <>
      <Text style={styles.body}>第 {match.terms_revision} 版 · 主揪：{label(match.host_member_number!)} · 已同意 {match.confirmed_count}／{match.member_count} 人</Text>
      <Text style={styles.body}>每人 NT$ {match.terms.cost_per_person_twd} · 全團 NT$ {match.terms.cost_per_person_twd * match.member_count}</Text>
      {match.known_cost_twd != null && match.terms.cost_per_person_twd !== match.known_cost_twd ? <Text style={styles.body}>費用已由配對時每人 NT$ {match.known_cost_twd} 調整為本版 NT$ {match.terms.cost_per_person_twd}。</Text> : null}
      {match.terms.cost_change_note ? <Text style={styles.body}>本組費用調整／補充原因：{match.terms.cost_change_note}</Text> : null}
      <Text style={styles.body}>下單：{label(match.terms.order_member)}；取餐：{label(match.terms.pickup_member)}</Text>
      <Text style={styles.body}>拼單截止／可退出至：{new Date(match.terms.deadline_at).toLocaleString('zh-TW')}</Text>
      <Text style={styles.body}>公開說明：{match.terms.content}</Text>
      <Text style={styles.body}>我的分工：{[match.terms.order_member === match.my_member_number ? '下單' : '', match.terms.pickup_member === match.my_member_number ? '取餐' : ''].filter(Boolean).join('、') || '依約參與分食'}。</Text>
      <Text style={styles.body}>同意代表已確認餐點細節、每人金額與自己的分工。全員同意這一版後自動建立公開拼單與團員聊天室，公開說明、主揪、分工者的顯示名稱會供登入用戶查看；私人需求原文不會公開。這不會代為訂餐、付款或扣款。</Text>
      {!editing && !match.my_terms_accepted ? <>
        <Pressable accessibilityRole="checkbox" accessibilityLabel="我已確認費用、我的分工與公開內容，同意全員確認後自動成團" accessibilityState={{ checked, disabled: busy }} disabled={busy} onPress={() => setChecked(!checked)} style={styles.choice}><Text>{checked ? '✓ ' : ''}我已確認費用、我的分工與公開內容，同意全員確認後自動成團</Text></Pressable>
        <PrimaryButton disabled={!checked || busy} onPress={() => consent.mutate()}>{consent.isPending ? '確認中…' : `同意第 ${match.terms_revision} 版並等待成團`}</PrimaryButton>
      </> : match.my_terms_accepted ? <Text style={styles.body}>你已同意這一版，等待其他人。要退出可使用下方「撤回我的意願」；修改方案將要求所有人重新同意。</Text> : null}
      <PrimaryButton secondary disabled={busy} onPress={() => { setEditing(!editing); setChecked(false); }}>{editing ? '取消編輯' : '修改方案（清除所有舊同意）'}</PrimaryButton>
    </> : <Text style={styles.body}>分身草案已填入下方，可先修改或補齊再提出。草案尚未送出，也沒有任何人的同意；仍可自行填寫方案。</Text>}
    {!match.terms || editing ? <>
      {match.agent_draft ? <PrimaryButton secondary disabled={busy} onPress={() => {
        const draft = match.agent_draft!;
        setContent(draft.content); setCost(draft.cost_per_person_twd === null ? '' : String(draft.cost_per_person_twd)); setCostNote('');
        setDeadline(draft.deadline_at); setOrder(draft.order_member ?? 0); setPickup(draft.pickup_member ?? 0);
        setChecked(false); setDeadlineError('');
      }}>還原分身草案（取代未儲存修改）</PrimaryButton> : null}
      <TextInput accessibilityLabel="成團公開說明" value={content} onChangeText={setContent} maxLength={300} multiline editable={!busy} style={styles.input} />
      <Text>每人費用（整數；含所有已協調費用）</Text><TextInput accessibilityLabel="成團每人費用" value={cost} onChangeText={setCost} keyboardType="number-pad" maxLength={6} editable={!busy} style={styles.input} />
      {overBudget ? <Text accessibilityRole="alert" style={styles.error}>每人費用超過共同預算 NT$ {match.budget_max_twd}，請協調後調整。</Text> : null}
      {costChanged || costNote ? <><Text style={styles.body}>配對時每人已知費用 NT$ {match.known_cost_twd ?? '未提供'}。若調整，請填至少五字原因，本組每位成員都會看到並重新確認；不會複製到公開拼單。</Text><TextInput accessibilityLabel="費用調整原因（本組成員可見）" value={costNote} onChangeText={setCostNote} maxLength={120} editable={!busy} multiline style={styles.input} /></> : null}
      <Text>拼單截止時間（預設配合區間結束）</Text>
      <Text style={styles.body}>{formatDeadline(new Date(deadline))}</Text>
      <PrimaryButton secondary disabled={busy || !now} onPress={() => { setDeadlineStart(startOfDay(now!())); setDraftDeadline(new Date(deadline)); setDeadlineError(''); setDeadlineVisible(true); }}>選擇成團截止時間</PrimaryButton>
      {!now ? <Text style={styles.body}>取得服務時間後即可調整截止；現在仍可使用預設值，伺服器會確認有效性。</Text> : null}
      {deadlineError ? <Text accessibilityRole="alert" style={styles.error}>{deadlineError}</Text> : null}
      <Text>誰負責下單</Text><View style={styles.row}>{members.map((n) => <PrimaryButton key={n} secondary={order !== n} disabled={busy} onPress={() => setOrder(n)}>{label(n)}下單</PrimaryButton>)}</View>
      {!order ? <Text style={styles.body}>尚未指定下單者，請協調後選擇，並由本人確認。</Text> : null}
      <Text>誰負責取餐</Text><View style={styles.row}>{members.map((n) => <PrimaryButton key={n} secondary={pickup !== n} disabled={busy} onPress={() => setPickup(n)}>{label(n)}取餐</PrimaryButton>)}</View>
      {!pickup ? <Text style={styles.body}>尚未指定取餐者，請協調後選擇，並由本人確認。</Text> : null}
      <Text style={styles.body}>金額不能超過共同預算；調整已知價格需說明原因並由全員確認。送出方案不代表任何人已同意，包含提案者在內都要另外確認。</Text>
      <PrimaryButton disabled={busy || !valid} onPress={() => save.mutate()}>{save.isPending ? '送出中…' : '提出方案，請全員確認'}</PrimaryButton>
    </> : null}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{coreError(error)}</Text> : null}
    <DeadlinePickerModal startDate={deadlineStart} value={draftDeadline} visible={deadlineVisible} onChange={setDraftDeadline} onClose={() => setDeadlineVisible(false)} onApply={() => {
      if (!now || draftDeadline.getTime() <= now() || draftDeadline.getTime() > Date.parse(match.ends_at)) { setDeadlineError('截止需晚於服務時間，且不超過配合區間結束。'); return; }
      setDeadline(draftDeadline.toISOString()); setDeadlineVisible(false); setDeadlineError('');
    }} />
  </View>;
}
function AgentDraftSummary({ draft }: { draft: StealthAgentTermsDraft }) {
  return <View style={{ gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: spacing.sm }}>
    <Text style={styles.heading}>分身自動提案 · 費用與分工草案</Text>
    <Text style={styles.body}>免費規則規劃器，未使用大型模型。只根據已確認條件提出建議，不代表已下單、成團或有人同意。</Text>
    <Text style={styles.body}>{draft.cost_per_person_twd === null ? '費用待補：沒有已知價格，預算上限不是售價。' : `依已知費用：每人 NT$ ${draft.cost_per_person_twd}，全團 NT$ ${draft.total_cost_twd}。`}</Text>
    {draft.budget_limit_twd !== null ? <Text style={styles.body}>共同每人預算上限：NT$ {draft.budget_limit_twd}，不會當作實際費用。</Text> : null}
    {draft.role_suggestions.map((role) => <Text key={role.role} style={styles.body}>{role.role === 'order' ? '下單' : '取餐'}建議：{role.member_number === null ? '待協調' : `成員 ${role.member_number}`}。{role.reason}</Text>)}
    {draft.missing_fields.length ? <Text style={styles.body}>原始草案待補：{draft.missing_fields.map((field) => ({ cost: '實際每人費用', order: '下單者', pickup: '取餐者' })[field]).join('、')}。補齊後才能提出方案。</Text> : null}
    {draft.needs_confirmation.map((item) => <Text key={item} style={styles.body}>• {item}</Text>)}
  </View>;
}
const styles = StyleSheet.create({ panel: { gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.yellowSoft }, heading: { fontSize: 17, fontWeight: '700', color: colors.ink }, body: { fontSize: 14, lineHeight: 23, color: colors.ink }, input: { padding: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: '#fff', minHeight: 44 }, choice: { padding: spacing.sm, borderWidth: 1, borderColor: colors.brown, borderRadius: radius.md }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, error: { color: colors.danger } });
