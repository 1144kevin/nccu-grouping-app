import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { View, StyleSheet } from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '@/components/app-text';
import { PrimaryButton } from '@/components/primitives';
import { coreError } from '@/lib/core-api';
import {
  intakeToForm,
  stealthApi,
  type SignalForm,
  type StealthIntake as IntakeResult,
} from '@/lib/stealth-api';
import { colors, radius, spacing } from '@/theme/tokens';
import { APPLE_INTAKE_ENABLED } from '@/lib/apple-intake';
import { AppleStealthIntake } from '@/components/apple-stealth-intake';

export function StealthIntake({
  onApplySummary,
  ...props
}: {
  onApply: (form: SignalForm) => void;
  disabled: boolean;
  onApplySummary?: (summary: string) => void;
}) {
  return APPLE_INTAKE_ENABLED ? (
    <AppleStealthIntake disabled={props.disabled} onApplySummary={onApplySummary} />
  ) : (
    <LegacyStealthIntake {...props} />
  );
}

function LegacyStealthIntake({
  onApply,
  disabled,
}: {
  onApply: (form: SignalForm) => void;
  disabled: boolean;
}) {
  const [text, setText] = useState('');
  const [turns, setTurns] = useState<string[]>([]);
  const [applied, setApplied] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const [result, setResult] = useState<IntakeResult>();
  const query = useMutation({
    gcTime: 0,
    retry: false,
    mutationFn: async (next: string[]) => ({
      result: await stealthApi.intake(next, result?.facts),
      next,
    }),
    onSuccess: (value) => {
      setResult(value.result);
      setTurns(value.next);
      setText('');
      setApplied(false);
      setShowEvidence(false);
    },
  });
  const busy = disabled || query.isPending;
  const restart = () => {
    query.reset();
    setResult(undefined);
    setTurns([]);
    setText('');
    setApplied(false);
  };
  return (
    <View style={styles.card}>
      <Text style={styles.title}>先跟分身說說看</Text>
      <Text style={styles.hint}>
        AI 協助整理中文需求；內容會送至 OpenAI 處理。補齊後請檢查表單並親自儲存。
      </Text>
      {turns.map((turn, index) => (
        <Text key={index} style={styles.body}>
          你：{turn}
        </Text>
      ))}
      {result ? (
        <View accessibilityLiveRegion="polite">
          <Text style={styles.hint}>
            已整理的資訊會保留；只需補充下方缺項。也可明確更正，套用前仍須本人核對。
          </Text>
          {query.isError ? (
            <Text style={styles.hint}>以下是上次整理結果；最新補充尚未成功，請重試後再套用。</Text>
          ) : null}
          <Text style={styles.body}>分身理解：{result.facts.title}</Text>
          <Text style={styles.body}>
            地點：
            {result.facts.location_id
              ? { main_gate: '政大正門', east_gate: '政大東側門', south_gate: '政大南門' }[
                  result.facts.location_id
                ]
              : '待補'}
            ；本人願意的分工：
            {result.facts.roles
              .map(
                (role) =>
                  ({ order: '下單', pickup: '取餐', coupon: '提供優惠券', share: '分食' })[role],
              )
              .join('、') || (result.facts.roles_confirmed ? '暫不負責' : '待確認')}
          </Text>
          <Text style={styles.body}>
            每人預算：
            {result.facts.budget_max_twd === null ? '未知' : `NT$ ${result.facts.budget_max_twd}`}
            ；已知每人費用：
            {result.facts.known_cost_twd === null
              ? '尚未確認'
              : `NT$ ${result.facts.known_cost_twd}`}
          </Text>
          <Text style={styles.hint}>
            時間：
            {result.facts.delay_minutes === null
              ? '開始時間待補'
              : `${result.facts.delay_minutes}分鐘後`}
            ／
            {result.facts.duration_minutes === null
              ? '可配合長度待補'
              : `持續${result.facts.duration_minutes}分鐘`}
            。角色與替代類型仍需在表單確認。
          </Text>
          {result.questions.map((question) => (
            <Text key={question.field} style={styles.question}>
              {question.text}
            </Text>
          ))}
          {result.facts.evidence ? (
            <>
              <PrimaryButton secondary onPress={() => setShowEvidence(!showEvidence)}>
                {showEvidence ? '收起理解依據' : '查看理解依據（你的原句）'}
              </PrimaryButton>
              {showEvidence
                ? Object.entries(result.facts.evidence)
                    .filter(([, quote]) => !!quote)
                    .map(([field, quote]) => (
                      <Text key={field} style={styles.hint}>
                        {
                          (
                            {
                              budget: '預算',
                              cost: '費用',
                              start: '開始',
                              duration: '持續時間',
                              roles: '角色',
                            } as Record<string, string>
                          )[field]
                        }
                        依據：{quote}
                      </Text>
                    ))
                : null}
            </>
          ) : null}
          {result.warnings.slice(4).map((warning) => (
            <Text key={warning} style={styles.hint}>
              {warning}
            </Text>
          ))}
          {result.ready_for_review ? (
            <Text style={styles.body}>資訊已足夠整理成待確認表單。</Text>
          ) : null}
          <Text style={styles.hint}>
            模型：{result.model}。未提供的費用保持未知；分工只採用本人願意的角色。
          </Text>
        </View>
      ) : null}
      <TextInput
        accessibilityLabel="跟分身說需求或補充資訊"
        placeholder="例如：想找人一起吃披薩，但我不方便取餐"
        value={text}
        onChangeText={setText}
        multiline
        maxLength={1000}
        editable={!busy}
        style={styles.input}
      />
      <PrimaryButton
        loading={query.isPending}
        disabled={
          busy || !text.trim() || turns.length >= 8 || turns.join('').length + text.length > 4000
        }
        onPress={() => query.mutate([...turns, text.trim()])}
      >
        {query.isPending
          ? '本機分身理解中，初次可能較久'
          : turns.length
            ? '補充並重新整理'
            : '讓本機分身理解'}
      </PrimaryButton>
      {query.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {coreError(query.error)} 可重試，或直接使用下方手動表單。
        </Text>
      ) : null}
      {result?.ready_for_review ? (
        <PrimaryButton
          secondary
          disabled={busy || applied || query.isError}
          onPress={() => {
            onApply(intakeToForm(result));
            setApplied(true);
          }}
        >
          套用到下方表單，逐項檢查
        </PrimaryButton>
      ) : null}
      {applied ? (
        <Text accessibilityRole="alert" style={styles.body}>
          已套用，尚未儲存。請檢查時間、角色與費用，再按「確認需求並交給分身」。
        </Text>
      ) : null}
      {turns.length || query.error ? (
        <PrimaryButton secondary disabled={busy} onPress={restart}>
          清除對話，重新開始
        </PrimaryButton>
      ) : null}
      {turns.length >= 8 ? (
        <Text style={styles.hint}>已達八輪，請清除對話重新描述，或使用手動表單。</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.ink },
  body: { fontSize: 15, color: colors.ink },
  hint: { fontSize: 13, lineHeight: 21, color: colors.muted },
  question: { fontSize: 15, lineHeight: 23, color: colors.ink },
  error: { color: '#b42318', fontSize: 14 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    minHeight: 90,
    padding: spacing.md,
    color: colors.ink,
  },
});
