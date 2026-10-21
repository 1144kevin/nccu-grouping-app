import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Keyboard, StyleSheet, View } from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '@/components/app-text';
import { PrimaryButton } from '@/components/primitives';
import {
  appleIntakeAvailability,
  appleIntakeMessage,
  cancelAppleIntake,
  newAppleIntakeRequestID,
  runAppleIntake,
  type AppleInterviewDraft,
} from '@/lib/apple-intake';
import { APPLE_INTAKE_LIMITS, appleIntakeInputProblem } from '@/lib/apple-intake-contract';
import { colors, radius, spacing } from '@/theme/tokens';

export function AppleStealthIntake({
  disabled,
  onApplySummary,
}: {
  disabled: boolean;
  onApplySummary?: (summary: string) => void;
}) {
  const [availability, setAvailability] = useState('checking');
  const [text, setText] = useState('');
  const [turns, setTurns] = useState<string[]>([]);
  const [editingLast, setEditingLast] = useState(false);
  const [draft, setDraft] = useState<AppleInterviewDraft>();
  const [reviewTitle, setReviewTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState(false);
  const [error, setError] = useState('');
  const [applied, setApplied] = useState(false);
  const generation = useRef(0);
  const requestID = useRef<string | null>(null);
  const foreground = useRef(AppState.currentState === 'active');
  const mounted = useRef(false);
  const availabilityGeneration = useRef(0);

  const nextTurns = editingLast ? [...turns.slice(0, -1), text.trim()] : [...turns, text.trim()];
  const inputProblem = text.trim()
    ? appleIntakeInputProblem(nextTurns)
    : !editingLast && turns.length >= APPLE_INTAKE_LIMITS.turns
      ? 'apple_ai_turn_limit'
      : !editingLast && turns.join('').length >= APPLE_INTAKE_LIMITS.conversationLength
        ? 'apple_ai_conversation_too_long'
        : undefined;

  const stop = () => {
    generation.current += 1;
    if (requestID.current) cancelAppleIntake(requestID.current);
    requestID.current = null;
    setBusy(false);
    setCurrent(false);
  };
  const check = useCallback(() => {
    const epoch = ++availabilityGeneration.current;
    return Promise.resolve()
      .then(appleIntakeAvailability)
      .then(
        (value) => {
          if (mounted.current && availabilityGeneration.current === epoch) setAvailability(value);
        },
        (cause) => {
          if (mounted.current && availabilityGeneration.current === epoch) {
            setAvailability(
              cause instanceof Error && cause.message === 'apple_ai_availability_timeout'
                ? cause.message
                : 'unavailable',
            );
          }
        },
      );
  }, []);
  useEffect(() => {
    mounted.current = true;
    void check();
    const listener = AppState.addEventListener('change', (state) => {
      const wasForeground = foreground.current;
      foreground.current = state === 'active';
      if (foreground.current && !wasForeground) {
        setAvailability('checking');
        void check();
      }
      if (state !== 'active') {
        availabilityGeneration.current += 1;
        generation.current += 1;
        if (requestID.current) {
          cancelAppleIntake(requestID.current);
          requestID.current = null;
          setBusy(false);
          setCurrent(false);
          setError('已暫停整理，對話與輸入仍保留；回來後可重試。');
        }
      }
    });
    return () => {
      mounted.current = false;
      availabilityGeneration.current += 1;
      generation.current += 1;
      if (requestID.current) cancelAppleIntake(requestID.current);
      listener.remove();
    };
  }, [check]);

  async function submit() {
    if (
      requestID.current ||
      disabled ||
      availability !== 'available' ||
      !foreground.current ||
      !text.trim()
    )
      return;
    const problem = appleIntakeInputProblem(nextTurns);
    if (problem) {
      setError(appleIntakeMessage(problem));
      return;
    }
    Keyboard.dismiss();
    const epoch = ++generation.current;
    const id = newAppleIntakeRequestID();
    requestID.current = id;
    setBusy(true);
    setCurrent(false);
    setApplied(false);
    setError('');
    try {
      const value = await runAppleIntake(id, nextTurns);
      if (generation.current !== epoch || !foreground.current) return;
      setDraft(value);
      setTurns(nextTurns);
      setText('');
      setEditingLast(false);
      setCurrent(true);
      setReviewTitle(value.summary.length <= APPLE_INTAKE_LIMITS.titleLength ? value.summary : '');
    } catch (cause) {
      if (generation.current === epoch) {
        setError(appleIntakeMessage(cause));
        setAvailability('checking');
        void check();
      }
    } finally {
      if (generation.current === epoch) {
        requestID.current = null;
        setBusy(false);
      }
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>先跟 Apple 分身說說看</Text>
      <Text style={styles.hint}>
        對話在這支 iPhone 上由 Apple AI
        整理，不送到後端或存入資料庫。這版先提供摘要與補問，可能不準確；金額、時間與角色請在下方手動核對填寫。
      </Text>
      <Text style={styles.hint}>
        {availability === 'checking' ? '正在檢查 Apple AI…' : appleIntakeMessage(availability)}
      </Text>
      {availability !== 'available' ? (
        <PrimaryButton
          secondary
          disabled={disabled || busy || availability === 'checking'}
          onPress={() => {
            setAvailability('checking');
            void check();
          }}
        >
          重新檢查 Apple AI
        </PrimaryButton>
      ) : null}
      {turns.map((turn, i) => (
        <Text key={i} selectable style={styles.body}>
          第{i + 1}輪 · 你：{turn}
        </Text>
      ))}
      {turns.length ? (
        <PrimaryButton
          secondary
          disabled={disabled || busy || !!text || editingLast}
          onPress={() => {
            setText(turns[turns.length - 1]);
            setEditingLast(true);
            setCurrent(false);
            setError('');
          }}
        >
          修改上一輪輸入
        </PrimaryButton>
      ) : null}
      {draft ? (
        <View accessibilityLiveRegion="polite">
          <Text style={styles.title}>待核對摘要</Text>
          {!current ? (
            <Text style={styles.hint}>這是上次整理結果；最新輸入尚未完成，請重試後再套用。</Text>
          ) : null}
          <Text testID="apple-intake-summary" selectable style={styles.body}>
            {draft.summary}
          </Text>
          {draft.questions.map((question, i) => (
            <Text key={i} selectable style={styles.body}>
              待確認：{question}
            </Text>
          ))}
          <Text style={styles.hint}>
            Apple 裝置端 AI · {Math.round(draft.elapsedMs)}{' '}
            ms。摘要與補問是建議，不代表條件已核對或已成團。
          </Text>
          {onApplySummary ? (
            <>
              <Text style={styles.hint}>可先對照自己的原話，修正下方標題，再決定是否採用。</Text>
              {draft.summary.length > APPLE_INTAKE_LIMITS.titleLength ? (
                <Text style={styles.hint}>摘要超過160字，請在下方整理成可採用的短標題。</Text>
              ) : null}
              <TextInput
                accessibilityLabel="核對後的需求標題"
                multiline
                value={reviewTitle}
                editable={!disabled && !busy && current}
                onChangeText={(value) => {
                  setReviewTitle(value);
                  setApplied(false);
                }}
                style={styles.input}
              />
              <Text
                style={
                  reviewTitle.length > APPLE_INTAKE_LIMITS.titleLength ? styles.error : styles.hint
                }
              >
                標題 {reviewTitle.length}/{APPLE_INTAKE_LIMITS.titleLength} 字
              </Text>
              <PrimaryButton
                secondary
                disabled={
                  disabled ||
                  busy ||
                  !current ||
                  applied ||
                  !reviewTitle.trim() ||
                  reviewTitle.length > APPLE_INTAKE_LIMITS.titleLength
                }
                onPress={() => {
                  onApplySummary(reviewTitle.trim());
                  setApplied(true);
                  Keyboard.dismiss();
                }}
              >
                將摘要放入需求標題，再手動核對
              </PrimaryButton>
            </>
          ) : null}
          {applied ? (
            <Text accessibilityRole="alert" style={styles.hint}>
              已套用需求標題，尚未儲存；金額、時間與分工沒有被 AI 改動。
            </Text>
          ) : null}
        </View>
      ) : null}
      {editingLast ? (
        <Text style={styles.hint}>
          正在修改第{turns.length}輪；重新整理成功後才會取代上一輪內容。
        </Text>
      ) : null}
      <TextInput
        accessibilityLabel="跟分身說需求或補充資訊"
        multiline
        editable={!busy && !disabled}
        style={styles.input}
        value={text}
        placeholder="例如：想喝熱湯，但我不方便取餐"
        onChangeText={(value) => {
          setText(value);
          setCurrent(false);
        }}
      />
      <Text style={styles.hint}>
        本次 {text.trim().length}/{APPLE_INTAKE_LIMITS.turnLength} 字 · 對話 {turns.length}/
        {APPLE_INTAKE_LIMITS.turns} 輪 · {nextTurns.join('').length}/
        {APPLE_INTAKE_LIMITS.conversationLength} 字
      </Text>
      {inputProblem ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {appleIntakeMessage(inputProblem)}
        </Text>
      ) : null}
      <PrimaryButton
        disabled={
          disabled || busy || availability !== 'available' || !text.trim() || !!inputProblem
        }
        onPress={() => {
          void submit();
        }}
      >
        {busy
          ? 'Apple 分身整理中…'
          : editingLast
            ? '更新上一輪並整理'
            : turns.length
              ? '補充並重新整理'
              : '讓 Apple 分身整理'}
      </PrimaryButton>
      {busy ? (
        <PrimaryButton
          secondary
          onPress={() => {
            stop();
            setError('已停止整理，輸入仍保留。');
          }}
        >
          停止整理
        </PrimaryButton>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      {(text || editingLast) && turns.length ? (
        <PrimaryButton
          secondary
          disabled={disabled || busy}
          onPress={() => {
            stop();
            setText('');
            setEditingLast(false);
            setCurrent(!!draft);
            setError('');
          }}
        >
          {editingLast ? '取消本次修改' : '放棄這次補充'}
        </PrimaryButton>
      ) : null}
      <Text style={styles.hint}>
        可以隨時直接使用下方手動表單；AI 不會自動勾選角色、填費用或儲存需求。
      </Text>
      {turns.length || draft || text ? (
        <PrimaryButton
          secondary
          disabled={disabled || busy}
          onPress={() => {
            stop();
            setTurns([]);
            setText('');
            setEditingLast(false);
            setDraft(undefined);
            setReviewTitle('');
            setError('');
            setApplied(false);
          }}
        >
          清除本機對話
        </PrimaryButton>
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
  title: { fontSize: 18, fontWeight: '800', color: colors.ink },
  body: { fontSize: 15, lineHeight: 23, color: colors.ink },
  hint: { fontSize: 13, lineHeight: 21, color: colors.muted },
  error: { fontSize: 14, color: colors.danger },
  input: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.ink,
  },
});
