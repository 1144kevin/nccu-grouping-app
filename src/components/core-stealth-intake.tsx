import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { View, StyleSheet } from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '@/components/app-text';
import { PrimaryButton } from '@/components/primitives';
import { coreError } from '@/lib/core-api';
import { intakeToForm, stealthApi, type SignalForm } from '@/lib/stealth-api';
import { colors, radius, spacing } from '@/theme/tokens';

export function StealthIntake({ onApply, disabled }: { onApply: (form: SignalForm) => void; disabled: boolean }) {
  const [text, setText] = useState('');
  const [turns, setTurns] = useState<string[]>([]);
  const [applied, setApplied] = useState(false);
  const query = useMutation({ gcTime: 0, retry: false, mutationFn: async (next: string[]) => ({ result: await stealthApi.intake(next), next }),
    onSuccess: (value) => { setTurns(value.next); setText(''); setApplied(false); } });
  const result = query.data?.result;
  const busy = disabled || query.isPending;
  const restart = () => { query.reset(); setTurns([]); setText(''); setApplied(false); };
  return <View style={styles.card}>
    <Text style={styles.title}>先跟分身說說看</Text>
    <Text style={styles.hint}>免費本機模型整理中文需求；對話只暫留此畫面，不會存入資料庫。補齊後仍需檢查下方表單並親自儲存。</Text>
    {turns.map((turn, index) => <Text key={index} style={styles.body}>你：{turn}</Text>)}
    {result ? <View accessibilityLiveRegion="polite"><Text style={styles.body}>分身理解：{result.facts.title}</Text>
      {result.questions.map((question) => <Text key={question.field} style={styles.question}>{question.text}</Text>)}
      {result.ready_for_review ? <Text style={styles.body}>資訊已足夠整理成待確認表單。</Text> : null}
      <Text style={styles.hint}>本機模型：{result.model}。未提供的費用保持未知；分工只採用本人願意的角色。</Text>
    </View> : null}
    <TextInput accessibilityLabel="跟分身說需求或補充資訊" placeholder="例如：想找人一起吃披薩，但我不方便取餐" value={text} onChangeText={setText} multiline maxLength={1000} editable={!busy} style={styles.input} />
    <PrimaryButton disabled={busy || !text.trim() || turns.length >= 8 || turns.join('').length + text.length > 4000} onPress={() => query.mutate([...turns, text.trim()])}>{query.isPending ? '本機分身理解中，初次可能較久…' : turns.length ? '補充並重新整理' : '讓本機分身理解'}</PrimaryButton>
    {query.error ? <Text accessibilityRole="alert" style={styles.error}>{coreError(query.error)} 可重試，或直接使用下方手動表單。</Text> : null}
    {result?.ready_for_review ? <PrimaryButton secondary disabled={busy || applied} onPress={() => { onApply(intakeToForm(result)); setApplied(true); }}>套用到下方表單，逐項檢查</PrimaryButton> : null}
    {applied ? <Text accessibilityRole="alert" style={styles.body}>已套用，尚未儲存。請檢查時間、角色與費用，再按「確認需求並交給分身」。</Text> : null}
    {turns.length || query.error ? <PrimaryButton secondary disabled={busy} onPress={restart}>清除對話，重新開始</PrimaryButton> : null}
    {turns.length >= 8 ? <Text style={styles.hint}>已達八輪，請清除對話重新描述，或使用手動表單。</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  card: { gap: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface },
  title: { fontSize: 20, fontWeight: '800', color: colors.ink }, body: { fontSize: 15, color: colors.ink },
  hint: { fontSize: 13, lineHeight: 21, color: colors.muted }, question: { fontSize: 15, lineHeight: 23, color: colors.ink },
  error: { color: '#b42318', fontSize: 14 }, input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, minHeight: 90, padding: spacing.md, color: colors.ink },
});
