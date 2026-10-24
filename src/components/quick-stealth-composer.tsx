import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppText as Text, AppTextInput as TextInput } from '@/components/app-text';
import { PrimaryButton } from '@/components/primitives';
import { coreError, newRequestKey } from '@/lib/core-api';
import {
  stealthApi,
  type StealthQuickInterview,
  type StealthQuickResult,
  type StealthSignalInput,
} from '@/lib/stealth-api';
import { startPostSpeech } from '@/lib/post-speech';
import type { SpeechCapture } from '@/lib/post-speech.types';
import { useAuthStore } from '@/store/auth-store';
import { colors, radius, spacing } from '@/theme/tokens';

type Props = {
  actor?: string;
  enabled: boolean;
  disabled: boolean;
  focused: boolean;
  onSaved: (result: StealthQuickResult) => Promise<void>;
  onBusyChange: (busy: boolean) => void;
};
type Phase = 'idle' | 'starting' | 'listening' | 'finishing' | 'interview' | 'saving';
const locations = { main_gate: '政大正門', east_gate: '政大東側門', south_gate: '政大南門' };
const roles = { order: '下單', pickup: '取餐', coupon: '提供優惠券', share: '分食' };

export function QuickStealthComposer({
  actor,
  enabled,
  disabled,
  focused,
  onSaved,
  onBusyChange,
}: Props) {
  const [text, setText] = useState('');
  const [turns, setTurns] = useState<string[]>([]);
  const [chat, setChat] = useState(false);
  const [preview, setPreview] = useState<StealthQuickInterview>();
  const [phase, setPhase] = useState<Phase>('idle');
  const [lastFocus, setLastFocus] = useState(focused);
  if (lastFocus !== focused) {
    setLastFocus(focused);
    if (!focused) setPhase('idle');
  }
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<StealthQuickResult>();
  const mounted = useRef(true);
  const visible = useRef(focused);
  const epoch = useRef(0);
  const locked = useRef(false);
  const capture = useRef<SpeechCapture | null>(null);
  const speechAbort = useRef<AbortController | null>(null);
  const request = useRef<{ payload: string; key: string } | null>(null);
  const busy = phase !== 'idle';
  useEffect(() => {
    onBusyChange(busy);
  }, [busy, onBusyChange]);
  function cancel() {
    epoch.current += 1;
    speechAbort.current?.abort();
    capture.current?.cancel();
    capture.current = null;
    speechAbort.current = null;
    locked.current = false;
    setPhase('idle');
  }
  useEffect(() => {
    visible.current = focused;
    if (!focused) {
      epoch.current += 1;
      speechAbort.current?.abort();
      capture.current?.cancel();
      capture.current = null;
      locked.current = false;
    }
  }, [focused]);
  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener('change', (state) => {
      // System permission sheets are inactive, not a reason to discard a recording.
      if (state === 'background') {
        epoch.current += 1;
        speechAbort.current?.abort();
        capture.current?.cancel();
        capture.current = null;
        locked.current = false;
        setPhase('idle');
      }
    });
    return () => {
      mounted.current = false;
      epoch.current += 1;
      speechAbort.current?.abort();
      capture.current?.cancel();
      subscription.remove();
      onBusyChange(false);
    };
  }, [onBusyChange]);
  const alive = (id: number) =>
    mounted.current &&
    visible.current &&
    epoch.current === id &&
    useAuthStore.getState().user?.id === actor;
  const inputValid =
    !!text.trim() &&
    text.length <= 1000 &&
    turns.length < 8 &&
    turns.join('').length + text.trim().length <= 4000;

  async function analyze(next: string[], id = ++epoch.current) {
    if (!actor || !alive(id)) return;
    locked.current = true;
    setPhase('interview');
    setError('');
    try {
      const result = await stealthApi.quickInterview(
        next,
        turns.length ? preview?.facts : undefined,
      );
      if (!alive(id)) return;
      setTurns(next);
      setPreview(result);
      setText('');
      setChat(true);
      request.current = null;
    } catch (e) {
      if (alive(id)) setError(`${coreError(e)} 補充已保留，可重試。`);
    } finally {
      if (alive(id)) {
        locked.current = false;
        setPhase('idle');
      }
    }
  }
  async function save(signal?: StealthSignalInput) {
    if (disabled || locked.current || !actor) return;
    if (!signal && text.trim().length > 160) {
      setChat(true);
      await analyze([text.trim()]);
      return;
    }
    const sentence = signal?.title ?? text.trim();
    if (!sentence) return;
    const id = ++epoch.current;
    const payload = JSON.stringify({ text: sentence, confirmed_signal: signal ?? null });
    if (request.current?.payload !== payload) request.current = { payload, key: newRequestKey() };
    locked.current = true;
    setPhase('saving');
    setError('');
    try {
      const result = signal
        ? await stealthApi.quickStart(sentence, !enabled, request.current.key, signal)
        : await stealthApi.quickStart(sentence, !enabled, request.current.key);
      if (!alive(id)) return;
      setSaved(result);
      setText('');
      setTurns([]);
      setPreview(undefined);
      setChat(false);
      request.current = null;
      await onSaved(result);
    } catch (e) {
      if (alive(id)) setError(`${coreError(e)} 輸入已保留，可重試。`);
    } finally {
      if (alive(id)) {
        locked.current = false;
        setPhase('idle');
      }
    }
  }
  async function speak() {
    if (disabled || locked.current || !actor) return;
    const id = ++epoch.current;
    const before = text.trim();
    let ended = false;
    const abort = new AbortController();
    speechAbort.current = abort;
    locked.current = true;
    setPhase('starting');
    setError('');
    const combine = (spoken: string) => [before, spoken.trim()].filter(Boolean).join('，');
    try {
      const session = await startPostSpeech(
        {
          onText: (spoken) => {
            if (alive(id)) setText(combine(spoken));
          },
          onEnd: (spoken) => {
            if (!alive(id)) return;
            ended = true;
            capture.current = null;
            const answer = combine(spoken);
            setText(answer);
            if (!spoken.trim()) {
              locked.current = false;
              setPhase('idle');
              setError('沒有辨識到語音，請重試或直接打字。');
              return;
            }
            if (
              answer.length > 1000 ||
              turns.join('').length + answer.length > 4000 ||
              turns.length >= 8
            ) {
              locked.current = false;
              setPhase('idle');
              setError('語音文字已保留，請縮短至每次 1000 字、合計 4000 字內。');
              return;
            }
            if (chat) {
              void analyze([...turns, answer], id);
            } else {
              locked.current = false;
              setPhase('idle');
            }
          },
          onError: (code) => {
            if (!alive(id)) return;
            ended = true;
            capture.current = null;
            locked.current = false;
            setPhase('idle');
            setError(coreError(new Error(code)));
          },
        },
        abort.signal,
      );
      if (!alive(id) || ended) {
        session.cancel();
        return;
      }
      capture.current = session;
      setPhase('listening');
    } catch (e) {
      if (alive(id)) {
        locked.current = false;
        setPhase('idle');
        setError(coreError(e));
      }
    }
  }
  function restart() {
    cancel();
    setText('');
    setTurns([]);
    setPreview(undefined);
    setChat(false);
    setError('');
    request.current = null;
  }
  const signal = preview?.signal;
  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <MaterialCommunityIcons name="robot-outline" size={28} color={colors.brown} />
        <Text style={styles.title}>一句話幫你揪</Text>
      </View>
      <Text style={styles.body}>
        想吃什麼、手上有什麼優惠，或願意幫忙做什麼，打字或說出來就好。
      </Text>
      {chat ? (
        <>
          <Text style={styles.hint}>
            聊天補充是選填，不用答完所有問題；確認目前資訊就能開始找人。
          </Text>
          {turns.map((turn, index) => (
            <View key={index} style={styles.bubble}>
              <Text style={styles.body}>你：{turn}</Text>
            </View>
          ))}
          {preview ? (
            <View accessibilityLiveRegion="polite" style={styles.summary}>
              <Text style={styles.subtitle}>分身目前理解</Text>
              <Text style={styles.body}>{preview.facts.title}</Text>
              {signal ? (
                <>
                  <Text style={styles.body}>
                    {
                      { need: '想找人一起吃', offer: '提供手上的資源', plan: '願意順路幫忙取餐' }[
                        signal.kind
                      ]
                    }{' '}
                    · {locations[signal.location_id]}
                  </Text>
                  <Text style={styles.hint}>
                    配合時間：{new Date(signal.starts_at).toLocaleString('zh-TW')} ～{' '}
                    {new Date(signal.ends_at).toLocaleString('zh-TW')}
                  </Text>
                  <Text style={styles.body}>
                    預算：
                    {signal.budget_max_twd === null
                      ? '未設定'
                      : `每人上限 NT$ ${signal.budget_max_twd}`}
                    ；已知費用：
                    {signal.known_cost_twd === null
                      ? '待協調'
                      : `每人 NT$ ${signal.known_cost_twd}`}
                  </Text>
                  <Text style={styles.body}>
                    本人願意：{signal.roles.map((role) => roles[role]).join('、') || '尚未承諾分工'}
                  </Text>
                </>
              ) : (
                <Text style={styles.hint}>
                  有必要資訊尚待釐清，請先回覆下方問題；其他細節可以稍後再談。
                </Text>
              )}
              {preview.sources.map((source) => (
                <Text key={source} style={styles.hint}>
                  {source}
                </Text>
              ))}
              {preview.questions.length ? (
                <Text style={styles.subtitle}>想補充的話，可以聊聊</Text>
              ) : null}
              {preview.questions.map((question) => (
                <Text key={question.field} style={styles.hint}>
                  {question.text}
                </Text>
              ))}
              {preview.interpretation === 'keyword_fallback' ? (
                <Text style={styles.hint}>目前先依關鍵字整理。AI 訪談未啟用時仍可直接幫你揪。</Text>
              ) : null}
            </View>
          ) : null}
        </>
      ) : null}
      <TextInput
        accessibilityLabel={chat ? '補充時間地點或預算' : '一句話告訴分身'}
        placeholder={
          chat
            ? '例如：改成東側門，30 分鐘後，預算 120 元'
            : '例如：想喝50嵐／我有披薩優惠券／我願意幫忙取餐'
        }
        multiline
        maxLength={1000}
        value={text}
        onChangeText={setText}
        editable={!busy}
        style={styles.input}
      />
      {phase === 'listening' ? (
        <>
          <Text accessibilityLiveRegion="polite" style={styles.body}>
            正在聆聽，每次最多 60 秒…
          </Text>
          <PrimaryButton
            onPress={() => {
              capture.current?.stop();
              setPhase('finishing');
            }}
          >
            說好了，{chat ? '補充給分身' : '確認語音文字'}
          </PrimaryButton>
          <PrimaryButton secondary onPress={cancel}>
            取消語音
          </PrimaryButton>
        </>
      ) : (
        <PrimaryButton
          secondary
          disabled={disabled || busy || !actor || turns.length >= 8}
          onPress={() => {
            void speak();
          }}
        >
          用語音{chat ? '回答' : '說一句'}
        </PrimaryButton>
      )}
      {busy ? (
        <Text accessibilityLiveRegion="polite" style={styles.hint}>
          {phase === 'starting'
            ? '正在取得語音權限…'
            : phase === 'interview'
              ? '分身正在整理補充…'
              : phase === 'saving'
                ? '分身正在理解並找人…'
                : phase === 'finishing'
                  ? '正在整理語音文字…'
                  : ''}
        </Text>
      ) : null}
      {phase === 'starting' || phase === 'finishing' ? (
        <PrimaryButton secondary onPress={cancel}>
          取消語音
        </PrimaryButton>
      ) : null}
      {!enabled ? (
        <Text style={styles.hint}>
          按下啟用並幫我揪，才會開啟分身並儲存需求；聊天整理不會先啟用。
        </Text>
      ) : null}
      {chat ? (
        <>
          <PrimaryButton
            secondary
            disabled={disabled || busy || !inputValid}
            onPress={() => {
              if (!locked.current) void analyze([...turns, text.trim()]);
            }}
          >
            補充給分身
          </PrimaryButton>
          <PrimaryButton
            disabled={disabled || busy || !signal || !!text.trim()}
            onPress={() => {
              if (signal) void save(signal);
            }}
          >
            {enabled ? '先用目前資訊幫我揪' : '啟用分身並用目前資訊幫我揪'}
          </PrimaryButton>
          {text.trim() && signal ? (
            <Text style={styles.hint}>還有未整理的補充，先送給分身，避免漏掉你的更正。</Text>
          ) : null}
          <PrimaryButton secondary disabled={busy} onPress={restart}>
            重新開始
          </PrimaryButton>
          {turns.length >= 8 ? (
            <Text style={styles.hint}>已聊到八輪，可確認目前資訊開始找人，或重新開始。</Text>
          ) : null}
        </>
      ) : (
        <>
          <Text style={styles.hint}>
            未指定時，先找正門、接下來兩小時；有近期同類需求時會參考地點與預算。
          </Text>
          <PrimaryButton
            disabled={disabled || busy || !inputValid}
            onPress={() => {
              void save();
            }}
          >
            {enabled ? '幫我揪' : '啟用分身並幫我揪'}
          </PrimaryButton>
          <PrimaryButton
            secondary
            disabled={disabled || busy || !inputValid}
            onPress={() => {
              setChat(true);
              if (!locked.current) void analyze([text.trim()]);
            }}
          >
            想講清楚，繼續聊聊（選填）
          </PrimaryButton>
        </>
      )}
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      {saved ? (
        <Text accessibilityLiveRegion="polite" style={styles.body}>
          已記住：{saved.created.signal.title}
          {saved.interpretation === 'keyword_fallback' ? '（依關鍵字整理）' : ''}
        </Text>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.md,
  },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { fontSize: 21, fontWeight: '800', color: colors.ink },
  subtitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  body: { fontSize: 15, lineHeight: 24, color: colors.ink },
  hint: { fontSize: 13, lineHeight: 21, color: colors.muted },
  input: {
    minHeight: 85,
    padding: spacing.md,
    backgroundColor: colors.surface,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    fontSize: 16,
  },
  bubble: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface },
  summary: {
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.yellowSoft,
    borderRadius: radius.md,
  },
  error: { color: colors.danger, lineHeight: 22 },
});
