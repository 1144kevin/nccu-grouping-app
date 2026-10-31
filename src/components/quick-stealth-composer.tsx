import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppText as Text } from '@/components/app-text';
import { ChatTextInput } from '@/components/chat-text-input';
import { PrimaryButton } from '@/components/primitives';
import { InlineLoading } from '@/components/inline-loading';
import { StealthRequestSummary } from '@/components/stealth-request-summary';
import { coreError, newRequestKey } from '@/lib/core-api';
import {
  stealthApi,
  type ConversationField,
  type StealthConversation,
  type StealthQuickResult,
} from '@/lib/stealth-api';
import { startPostSpeech } from '@/lib/post-speech';
import { createReplyVoice, type ReplyVoice } from '@/lib/reply-voice';
import type { SpeechCapture } from '@/lib/post-speech.types';
import { useAuthStore } from '@/store/auth-store';
import { useStealthPreferencesStore } from '@/store/stealth-preferences-store';
import { colors } from '@/theme/tokens';

type Props = {
  actor?: string;
  enabled: boolean;
  disabled: boolean;
  focused: boolean;
  onSaved: (result: StealthQuickResult) => Promise<void>;
  onBusyChange: (busy: boolean) => void;
  onStarted?: () => void;
};
type Phase = 'idle' | 'starting' | 'listening' | 'finishing' | 'interview' | 'saving';
type Message = { role: 'user' | 'assistant'; text: string };
const greeting = '今天有什麼想跟我分享的嗎？';
const starters = [
  { icon: 'cup-outline' as const, label: '想喝飲料', answer: '我想找人一起喝飲料' },
  { icon: 'ticket-percent-outline' as const, label: '手上有優惠', answer: '我有優惠券想分享' },
  { icon: 'moped-outline' as const, label: '可以順路拿', answer: '我願意順路幫忙取餐' },
];

export function QuickStealthComposer({
  actor,
  enabled,
  disabled,
  focused,
  onSaved,
  onBusyChange,
  onStarted,
}: Props) {
  const [text, setText] = useState('');
  const [voiceReview, setVoiceReview] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voicePlaying, setVoicePlaying] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [turns, setTurns] = useState<string[]>([]);
  const [fields, setFields] = useState<(ConversationField | null)[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [preview, setPreview] = useState<StealthConversation>();
  const [phase, setPhase] = useState<Phase>('idle');
  const [reviewing, setReviewing] = useState(false);
  const [pendingAnswer, setPendingAnswer] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [lastFocus, setLastFocus] = useState(focused);
  if (lastFocus !== focused) {
    setLastFocus(focused);
    if (!focused) {
      setPhase('idle');
      setPendingAnswer('');
    }
  }
  const transcript = useRef<ScrollView>(null);
  const mounted = useRef(true);
  const visible = useRef(focused);
  const epoch = useRef(0);
  const locked = useRef(false);
  const capture = useRef<SpeechCapture | null>(null);
  const replyVoice = useRef<ReplyVoice | null>(null);
  const voiceEnabledRef = useRef(false);
  const speechAbort = useRef<AbortController | null>(null);
  const inferenceAbort = useRef<AbortController | null>(null);
  const request = useRef<{ payload: string; key: string } | null>(null);
  const busy = phase !== 'idle';
  useEffect(() => {
    onBusyChange(busy);
  }, [busy, onBusyChange]);
  const cancel = useCallback(() => {
    epoch.current += 1;
    speechAbort.current?.abort();
    inferenceAbort.current?.abort();
    capture.current?.cancel();
    capture.current = null;
    replyVoice.current?.stop();
    locked.current = false;
    setPendingAnswer('');
    setPhase('idle');
  }, []);
  useEffect(() => {
    visible.current = focused;
    if (!focused) {
      epoch.current += 1;
      speechAbort.current?.abort();
      inferenceAbort.current?.abort();
      capture.current?.cancel();
      capture.current = null;
      replyVoice.current?.stop();
      locked.current = false;
    }
  }, [focused]);
  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') cancel();
    });
    return () => {
      mounted.current = false;
      epoch.current += 1;
      speechAbort.current?.abort();
      inferenceAbort.current?.abort();
      capture.current?.cancel();
      replyVoice.current?.stop();
      subscription.remove();
      onBusyChange(false);
    };
  }, [onBusyChange, cancel]);
  const alive = (id: number) =>
    mounted.current &&
    visible.current &&
    epoch.current === id &&
    useAuthStore.getState().user?.id === actor;
  const validAnswer = (answer: string) =>
    !!answer.trim() &&
    answer.length <= 1000 &&
    turns.length < 16 &&
    turns.join('').length + answer.trim().length <= 4000;
  const inputValid = validAnswer(text);
  const playReply = (message: string) => {
    if (!focused || !mounted.current || useAuthStore.getState().user?.id !== actor) return;
    replyVoice.current ??= createReplyVoice(true);
    setVoiceError('');
    if (!replyVoice.current) {
      setVoiceError('目前裝置不支援朗讀，仍可繼續文字聊天。');
      return;
    }
    replyVoice.current.speak(
      message,
      (playing) => {
        if (mounted.current && visible.current) setVoicePlaying(playing);
      },
      () => {
        if (mounted.current && visible.current)
          setVoiceError('朗讀未完成，可按「重聽回覆」再試一次，文字不受影響。');
      },
    );
  };
  const toggleVoice = () => {
    const enabled = !voiceEnabledRef.current;
    voiceEnabledRef.current = enabled;
    setVoiceEnabled(enabled);
    if (enabled)
      playReply(
        busy
          ? '語音回覆已開啟，回覆完成後會為你朗讀。'
          : (messages.filter((m) => m.role === 'assistant').at(-1)?.text ?? greeting),
      );
    else replyVoice.current?.stop();
  };

  async function analyze(answer: string, display = answer, id = ++epoch.current) {
    if (!actor || disabled || !alive(id) || !validAnswer(answer)) return;
    onStarted?.();
    replyVoice.current?.stop();
    locked.current = true;
    setPhase('interview');
    setError('');
    setVoiceReview(false);
    setReviewing(false);
    setPendingAnswer(display);
    const next = [...turns, answer.trim()];
    const nextFields = [...fields, preview?.question?.field ?? null];
    const controller = new AbortController();
    inferenceAbort.current = controller;
    try {
      const result = await stealthApi.conversation(
        next,
        preview?.facts,
        nextFields,
        controller.signal,
        messages.filter((message) => message.role === 'assistant').map((message) => message.text),
        useStealthPreferencesStore.getState().accounts[actor],
      );
      if (!alive(id)) return;
      setTurns(next);
      setFields(nextFields);
      setPreview(result);
      setText('');
      setMessages((old) => [
        ...old,
        { role: 'user', text: display },
        { role: 'assistant', text: result.message },
      ]);
      setReviewing(result.ready_for_review);
      request.current = null;
      if (voiceEnabledRef.current) playReply(result.message);
    } catch (e) {
      if (alive(id)) {
        setText(answer);
        setError(`${coreError(e)} 這次補充已保留，按傳送即可重試。`);
      }
    } finally {
      if (alive(id)) {
        locked.current = false;
        setPendingAnswer('');
        setPhase('idle');
      }
    }
  }
  async function save() {
    const signal = preview?.signal;
    if (disabled || locked.current || !actor || !signal || text.trim() || !reviewing) return;
    const id = ++epoch.current;
    const payload = JSON.stringify(signal);
    replyVoice.current?.stop();
    if (request.current?.payload !== payload) request.current = { payload, key: newRequestKey() };
    locked.current = true;
    setPhase('saving');
    setError('');
    try {
      const result = await stealthApi.quickStart(
        signal.title,
        !enabled,
        request.current.key,
        signal,
      );
      if (!alive(id)) return;
      setSaved(true);
      await onSaved(result);
    } catch (e) {
      if (alive(id)) setError(`${coreError(e)} 已確認的條件仍保留，可以重試，不會重複建立。`);
    } finally {
      if (alive(id)) {
        locked.current = false;
        setPhase('idle');
      }
    }
  }
  async function speak() {
    if (disabled || locked.current || !actor || turns.length >= 16) return;
    onStarted?.();
    replyVoice.current?.stop();
    const id = ++epoch.current;
    const before = text.trim();
    let ended = false;
    const abort = new AbortController();
    speechAbort.current = abort;
    locked.current = true;
    setPhase('starting');
    setError('');
    setReviewing(false);
    const combine = (spoken: string) => [before, spoken.trim()].filter(Boolean).join('，');
    try {
      const session = await startPostSpeech(
        {
          onText: (spoken) => {
            if (alive(id) && !ended) {
              setText(combine(spoken));
              setVoiceReview(!!spoken.trim());
            }
          },
          onEnd: (spoken) => {
            if (!alive(id) || ended) return;
            ended = true;
            capture.current = null;
            const answer = combine(spoken);
            setText(answer);
            if (!spoken.trim() || !validAnswer(answer)) {
              locked.current = false;
              setPhase('idle');
              setError(
                !spoken.trim()
                  ? '沒有辨識到語音，可以重試或直接打字。'
                  : '語音文字已保留，每次最多 1000 字、整段對話最多 4000 字。',
              );
              return;
            }
            // Recognition only prepares a draft. The user edits and explicitly
            // confirms before anything is sent to the conversation endpoint.
            locked.current = false;
            setPhase('idle');
            setVoiceReview(true);
          },
          onError: (code) => {
            if (alive(id) && !ended) {
              ended = true;
              capture.current = null;
              locked.current = false;
              setPhase('idle');
              setError(coreError(new Error(code)));
            }
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
    setVoiceReview(false);
    setTurns([]);
    setFields([]);
    setMessages([]);
    setPreview(undefined);
    setReviewing(false);
    setSaved(false);
    setError('');
    request.current = null;
  }
  if (saved)
    return (
      <View style={styles.saved}>
        <View style={styles.savedIcon}>
          <MaterialCommunityIcons name="check" size={22} color={colors.ink} />
        </View>
        <View style={{ flex: 1, gap: 5 }}>
          <Text style={styles.savedTitle}>需求已儲存</Text>
          <Text style={styles.hint}>到下方查看配對進度，任何邀請都由你決定。</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={restart} style={styles.smallButton}>
          <Text style={styles.link}>再聊一個</Text>
        </Pressable>
      </View>
    );
  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <View style={{ flex: 1 }} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={voiceEnabled ? '關閉語音回覆' : '開啟語音回覆'}
          accessibilityState={{ selected: voiceEnabled }}
          disabled={
            !focused || phase === 'listening' || phase === 'starting' || phase === 'finishing'
          }
          onPress={toggleVoice}
          style={styles.voiceToggle}
        >
          <MaterialCommunityIcons
            name={voiceEnabled ? 'volume-high' : 'volume-off'}
            size={21}
            color={voiceEnabled ? colors.ink : colors.muted}
          />
        </Pressable>
        {turns.length ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="重新開始對話"
            disabled={busy}
            onPress={restart}
          >
            <MaterialCommunityIcons name="restart" size={20} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
      {voiceEnabled ? (
        <View style={styles.voiceStatus}>
          <View />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={voicePlaying ? '停止朗讀' : '重聽回覆'}
            disabled={busy && !voicePlaying}
            onPress={() => {
              if (voicePlaying) replyVoice.current?.stop();
              else
                playReply(messages.filter((m) => m.role === 'assistant').at(-1)?.text ?? greeting);
            }}
          >
            <Text style={styles.link}>{voicePlaying ? '停止朗讀' : '重聽回覆'}</Text>
          </Pressable>
        </View>
      ) : null}
      {voiceError ? (
        <Text accessibilityRole="alert" style={styles.hint}>
          {voiceError}
        </Text>
      ) : null}
      <ScrollView
        ref={transcript}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={[styles.transcript, voiceReview && { maxHeight: 140 }]}
        contentContainerStyle={styles.messages}
        onContentSizeChange={() => transcript.current?.scrollToEnd({ animated: true })}
      >
        {!messages.length && !pendingAnswer && phase !== 'interview' ? (
          <View style={styles.greeting}>
            <Text style={styles.greetingText}>{greeting}</Text>
          </View>
        ) : null}
        {messages.map((message, index) => (
          <View
            key={index}
            style={[
              styles.bubble,
              message.role === 'user' ? styles.userBubble : styles.assistantBubble,
            ]}
          >
            <Text style={styles.body}>{message.text}</Text>
          </View>
        ))}
        {pendingAnswer ? (
          <View style={styles.userBubble}>
            <Text style={styles.body}>{pendingAnswer}</Text>
          </View>
        ) : null}
        {phase === 'interview' ? (
          <View style={styles.assistantBubble}>
            <InlineLoading label="正在整理回覆" textStyle={styles.hint} />
          </View>
        ) : null}
      </ScrollView>
      {!turns.length && !busy && !voiceReview ? (
        <View style={styles.choices}>
          {starters.map((item) => (
            <Pressable
              key={item.label}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              disabled={disabled || !!text.trim()}
              onPress={() => {
                if (!locked.current) void analyze(item.answer, item.label);
              }}
              style={styles.starter}
            >
              <Text style={styles.choiceText}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {preview?.question && !busy && !voiceReview ? (
        <View style={styles.choices}>
          {preview.choices.map((choice) => (
            <Pressable
              key={choice.answer}
              accessibilityRole="button"
              disabled={disabled || !!text.trim()}
              onPress={() => {
                if (!locked.current) void analyze(choice.answer, choice.label);
              }}
              style={styles.choice}
            >
              <Text style={styles.choiceText}>{choice.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {voiceReview && !busy ? (
        <View style={styles.voiceReviewHeading} accessibilityLiveRegion="polite">
          <Text style={styles.name}>確認語音文字</Text>
          <Text style={styles.hint}>可修改後再送出。</Text>
        </View>
      ) : null}
      <View style={styles.composer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="用語音回答"
          disabled={disabled || busy}
          onPress={() => {
            void speak();
          }}
          style={styles.voice}
        >
          <MaterialCommunityIcons
            name="microphone-outline"
            size={23}
            color={busy || disabled ? colors.subtle : colors.ink}
          />
        </Pressable>
        <ChatTextInput
          emptyCentered
          accessibilityLabel="跟偷揪分身聊天"
          placeholder="說說你的想法"
          value={text}
          onChangeText={(value) => {
            setText(value);
            if (value.trim()) setReviewing(false);
          }}
          multiline
          maxLength={1000}
          editable={!busy && !disabled}
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={voiceReview ? '送出語音文字' : '傳送給分身'}
          accessibilityState={{ busy: phase === 'interview' }}
          disabled={disabled || busy || !inputValid}
          onPress={() => {
            if (!locked.current) void analyze(text);
          }}
          style={[styles.send, (disabled || busy || !inputValid) && styles.disabled]}
        >
          {phase === 'interview' ? (
            <ActivityIndicator
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel="正在理解"
              size="small"
              color={colors.ink}
            />
          ) : (
            <MaterialCommunityIcons name="arrow-up" size={23} color={colors.ink} />
          )}
        </Pressable>
      </View>
      {phase === 'listening' ? (
        <View style={styles.voicePanel}>
          <Text style={styles.body}>正在聆聽，每次最多 60 秒</Text>
          <PrimaryButton
            onPress={() => {
              setPhase('finishing');
              capture.current?.stop();
            }}
          >
            結束錄音
          </PrimaryButton>
          <PrimaryButton secondary onPress={cancel}>
            取消語音
          </PrimaryButton>
        </View>
      ) : null}
      {phase === 'starting' || phase === 'finishing' ? (
        <View style={styles.voicePanel}>
          <InlineLoading label={phase === 'starting' ? '正在取得語音權限' : '正在整理語音文字'} />
          <PrimaryButton secondary onPress={cancel}>
            取消語音
          </PrimaryButton>
        </View>
      ) : null}
      {voiceReview && !busy ? (
        <PrimaryButton
          disabled={disabled || !inputValid}
          onPress={() => {
            if (!locked.current) void analyze(text);
          }}
        >
          確認文字並送出
        </PrimaryButton>
      ) : null}
      {preview?.signal && !reviewing ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="先確認目前需求"
          disabled={busy || !!text.trim()}
          onPress={() => setReviewing(true)}
          style={styles.reviewLink}
        >
          <Text style={styles.link}>先確認目前需求</Text>
          <MaterialCommunityIcons name="arrow-right" size={16} color={colors.brown} />
        </Pressable>
      ) : null}
      {reviewing && preview?.signal ? (
        <View style={styles.review}>
          <View style={styles.reviewTitle}>
            <MaterialCommunityIcons name="clipboard-check-outline" size={20} color={colors.brown} />
            <Text style={styles.savedTitle}>這次幫你找</Text>
          </View>
          <StealthRequestSummary signal={preview.signal} facts={preview.facts} />
          <PrimaryButton
            loading={phase === 'saving'}
            disabled={disabled || busy || !!text.trim()}
            onPress={() => {
              void save();
            }}
          >
            確認條件，開始找人
          </PrimaryButton>
          <Text style={styles.footnote}>確認後才開始找人，邀請由你決定。</Text>
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => setReviewing(false)}>
            <Text style={styles.link}>回到聊天補充</Text>
          </Pressable>
        </View>
      ) : null}
      {turns.length >= 16 ? (
        <Text style={styles.hint}>這段對話已達長度上限，可以確認目前需求，或重新開始。</Text>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.background,
    borderRadius: 0,
    overflow: 'hidden',
    padding: 0,
    gap: 16,
    flexGrow: 1,
  },
  panelHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  voiceToggle: { minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  voiceStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  name: { fontSize: 15, fontWeight: '800', color: colors.ink },
  hint: { fontSize: 12, lineHeight: 19, color: colors.muted },
  transcript: { maxHeight: 460, minHeight: 180, flexGrow: 1 },
  greeting: { paddingTop: 16, paddingBottom: 28 },
  greetingText: { fontSize: 25, lineHeight: 37, fontWeight: '600', color: colors.ink },
  messages: { gap: 12, paddingVertical: 4 },
  bubble: { maxWidth: '94%', borderRadius: 18, padding: 14 },
  assistantBubble: {
    alignSelf: 'flex-start',
    maxWidth: '94%',
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderTopLeftRadius: 4,
    padding: 14,
  },
  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '90%',
    borderRadius: 18,
    borderBottomRightRadius: 4,
    backgroundColor: '#F0EFEB',
    padding: 14,
  },
  body: { fontSize: 15, lineHeight: 25, color: colors.ink },
  choices: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  starter: {
    flexGrow: 1,
    flexBasis: 90,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 0,
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingVertical: 9,
    paddingHorizontal: 10,
    flexDirection: 'row',
  },
  choice: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  choiceText: { fontSize: 13, lineHeight: 20, color: colors.ink },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderWidth: 0,
    padding: 6,
    gap: 6,
  },
  voice: { width: 34, height: 38, alignItems: 'center', justifyContent: 'center' },
  input: {
    flex: 1,
    color: colors.ink,
    fontSize: 16,
    lineHeight: 23,
  },
  send: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
  footnote: { fontSize: 12, lineHeight: 19, color: colors.muted },
  reviewLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    alignItems: 'center',
    padding: 6,
  },
  link: {
    color: colors.brown,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 22,
    textAlign: 'center',
  },
  review: {
    backgroundColor: colors.background,
    borderWidth: 0,
    borderRadius: 18,
    padding: 0,
    gap: 14,
  },
  reviewTitle: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  saved: {
    flexDirection: 'row',
    gap: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 15,
    alignItems: 'center',
  },
  savedTitle: { fontSize: 16, fontWeight: '800', color: colors.ink },
  savedIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.yellowSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallButton: { padding: 4 },
  voicePanel: { gap: 10 },
  voiceReviewHeading: { gap: 4, paddingTop: 4 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 21 },
});
