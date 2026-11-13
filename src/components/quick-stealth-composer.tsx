import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
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
  type StealthSignal,
} from '@/lib/stealth-api';
import { startPostSpeech } from '@/lib/post-speech';
import { createReplyVoice, type ReplyVoice } from '@/lib/reply-voice';
import type { SpeechCapture } from '@/lib/post-speech.types';
import { useAuthStore } from '@/store/auth-store';
import { useStealthPreferencesStore } from '@/store/stealth-preferences-store';
import { colors, yellowSurface } from '@/theme/tokens';

type Props = {
  viewportHeight?: number;
  actor?: string;
  enabled: boolean;
  disabled: boolean;
  focused: boolean;
  hasActiveSignal?: boolean;
  activeSignal?: StealthSignal;
  progressStage?: 0 | 1 | 2 | 3 | 4;
  cancelling?: boolean;
  onCancelActiveSignal?: () => Promise<void>;
  onRestartStealth?: () => Promise<void>;
  chatStreamExtra?: ReactNode;
  onSaved: (result: StealthQuickResult) => Promise<void>;
  onBusyChange: (busy: boolean) => void;
  onStarted?: () => void;
};
type Phase = 'idle' | 'starting' | 'listening' | 'finishing' | 'interview' | 'saving';
type Message = { role: 'user' | 'assistant'; text: string };
const greeting = '今天有什麼想跟我分享的嗎？';
const PROGRESS_STEPS = ['建立需求單', '找到偷揪夥伴', '聊聊中', '偷揪成立'] as const;
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
  hasActiveSignal = false,
  activeSignal,
  progressStage,
  cancelling = false,
  onCancelActiveSignal,
  onRestartStealth,
  chatStreamExtra,
  onSaved,
  onBusyChange,
  onStarted,
}: Props) {
  const effectiveStage = progressStage ?? (hasActiveSignal ? 1 : 0);
  const chatLocked = effectiveStage >= 1 && effectiveStage < 4;
  const draft = useStealthPreferencesStore((s) => (actor ? s.drafts?.[actor] : undefined));
  const saveDraft = useStealthPreferencesStore((s) => s.saveDraft);
  const clearDraft = useStealthPreferencesStore((s) => s.clearDraft);
  const [requestPanel, setRequestPanel] = useState(false);
  const [text, setText] = useState('');
  const [voiceReview, setVoiceReview] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [, setVoicePlaying] = useState(false);
  const [voicePreparing, setVoicePreparing] = useState(false);
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
  // The card under review comes from the live conversation, or from the persisted
  // draft when the conversation was lost (leave / refresh) and the user restores it.
  const pendingSignal = preview?.signal ?? (reviewing ? draft?.signal : undefined);
  const pendingFacts = preview?.signal ? preview.facts : draft?.facts;
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
      replyVoice.current?.dispose?.();
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
        if (mounted.current && visible.current) {
          setVoicePlaying(playing);
          if (!playing) setVoicePreparing(false);
        }
      },
      (code) => {
        if (mounted.current && visible.current)
          setVoiceError(code === 'openai_budget_exhausted'
            ? '已達本機 AI 預算上限，暫停朗讀；文字不受影響。'
            : code === 'openai_quota_or_rate_limit'
              ? 'OpenAI 額度不足或請求過於頻繁，暫停朗讀；文字不受影響。'
              : '朗讀未完成，可按「重聽回覆」再試一次，文字不受影響。');
      },
      (pending) => {
        if (mounted.current && visible.current) setVoicePreparing(pending);
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
    if (!actor || disabled || chatLocked || !alive(id) || !validAnswer(answer)) return;
    onStarted?.();
    replyVoice.current?.stop();
    locked.current = true;
    setPhase('interview');
    setError('');
    setVoiceReview(false);
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
      // Only automatically pop out the card when the AI determines the threshold is met (ready_for_review).
      setReviewing(Boolean(result.signal && result.ready_for_review));
      if (result.signal && result.ready_for_review)
        saveDraft(actor, {
          signal: result.signal,
          facts: result.facts,
          updatedAt: new Date().toISOString(),
        });
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
  async function save(allowWithInput = false) {
    const signal = pendingSignal;
    if (
      disabled ||
      locked.current ||
      !actor ||
      !signal ||
      (!allowWithInput && text.trim()) ||
      !reviewing
    )
      return;
    if (hasActiveSignal) {
      setError('目前已經有一張進行中的偷揪單（同時最多一張），請先取消目前的偷揪單才能建立新單。');
      setMessages((old) => [
        ...old,
        {
          role: 'assistant',
          text: '你目前已經有一張等待配對中的偷揪單（同時最多只能有一張）。如果覺得目前那張單不行，請先點擊卡片右上角的「✕」取消它，才能開一張新的偷揪單喔！',
        },
      ]);
      return;
    }
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
      setReviewing(false);
      clearDraft(actor);
      setMessages((old) => [
        ...old,
        {
          role: 'assistant',
          text: '已用這張偷揪單開始等待配對（有效期限 24 小時）！配對到合適夥伴時會直接在這裡通知你。',
        },
      ]);
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
  function submitInput(rawText: string, displayLabel = rawText) {
    const cleaned = rawText.trim();
    if (!cleaned || locked.current || chatLocked) return;
    if (reviewing && pendingSignal && !saved) {
      if (/^(同意|好|可以|確認|同意開始配對|開始配對|ok|yes)$/i.test(cleaned)) {
        setText('');
        setMessages((old) => [...old, { role: 'user', text: displayLabel }]);
        void save(true);
        return;
      }
      if (/^(不同意|不要|取消|修改|先不要|no)$/i.test(cleaned)) {
        setText('');
        setReviewing(false);
        setMessages((old) => [
          ...old,
          { role: 'user', text: displayLabel },
          {
            role: 'assistant',
            text: '沒問題，這張偷揪單先不送出！想調整地點、時間、預算或 BONUS 特別項目，都可以直接跟我說。',
          },
        ]);
        return;
      }
    }
    void analyze(rawText, displayLabel);
  }
  async function speak() {
    if (disabled || chatLocked || locked.current || !actor || turns.length >= 16) return;
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
          {voicePreparing ? (
            <ActivityIndicator accessibilityLabel="正在準備語音" size="small" color={colors.ink} />
          ) : (
            <MaterialCommunityIcons
              name={voiceEnabled ? 'volume-high' : 'volume-off'}
              size={21}
              color={voiceEnabled ? colors.ink : colors.muted}
            />
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="重新開始對話"
          disabled={busy}
          onPress={restart}
          style={styles.voiceToggle}
        >
          <MaterialCommunityIcons name="restart" size={20} color={colors.muted} />
        </Pressable>
      </View>
      <ScrollView
        ref={transcript}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={styles.transcript}
        contentContainerStyle={styles.messages}
        onContentSizeChange={() => transcript.current?.scrollToEnd({ animated: true })}
      >
        {!messages.length && !pendingAnswer && phase !== 'interview' ? (
          <View style={styles.greeting}>
            <Text style={styles.greetingText}>{greeting}</Text>
            <Text style={styles.hint}>對話與配對需求會傳送至 OpenAI 處理；語音回覆由 AI 產生。</Text>
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
        {preview?.signal && !reviewing && !saved ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="先確認目前需求"
            disabled={busy || !!text.trim()}
            onPress={() => setReviewing(true)}
            style={[styles.reviewLink, (busy || !!text.trim()) && styles.disabled]}
          >
            <Text style={styles.link}>先確認目前需求</Text>
            <MaterialCommunityIcons name="arrow-right" size={16} color={colors.brown} />
          </Pressable>
        ) : null}
        {reviewing && pendingSignal && !saved ? (
          <View style={styles.inChatCardBlock}>
            <StealthRequestSummary compact signal={pendingSignal} facts={pendingFacts} />
            <View style={styles.assistantBubble}>
              <Text style={styles.body}>
                已經幫你整理好這張偷揪單囉！請問是否要用這張單開始配對？（請輸入「同意」或「不同意」）
              </Text>
            </View>
            <View style={styles.review}>
              <PrimaryButton
                loading={phase === 'saving'}
                disabled={disabled || busy || !!text.trim()}
                onPress={() => {
                  void save();
                }}
              >
                確認條件，開始找人
              </PrimaryButton>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => setReviewing(false)}
              >
                <Text style={styles.link}>不同意，回到聊天補充</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
        {chatStreamExtra}
        {turns.length >= 16 ? (
          <Text style={styles.hint}>這段對話已達長度上限，可以確認目前需求，或重新開始。</Text>
        ) : null}
        {error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        ) : null}
      </ScrollView>
      {!turns.length && !busy && !voiceReview && !requestPanel && !chatLocked ? (
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
      {reviewing && pendingSignal && !saved && !busy && !voiceReview ? (
        <View style={styles.choices}>
          <Pressable
            accessibilityRole="button"
            disabled={disabled || !!text.trim()}
            onPress={() => submitInput('同意', '同意')}
            style={styles.choice}
          >
            <Text style={styles.choiceText}>同意</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={disabled || !!text.trim()}
            onPress={() => submitInput('不同意', '不同意')}
            style={styles.choice}
          >
            <Text style={styles.choiceText}>不同意</Text>
          </Pressable>
        </View>
      ) : preview?.question && !busy && !voiceReview ? (
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
      {voiceError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {voiceError}
        </Text>
      ) : null}
      {requestPanel ? (
        <View style={styles.requestPanel}>
          <View style={styles.requestPanelHeader}>
            <Text style={styles.name}>目前的需求單進度</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="關閉需求單進度"
              hitSlop={10}
              onPress={() => setRequestPanel(false)}
            >
              <MaterialCommunityIcons name="close" size={20} color={colors.muted} />
            </Pressable>
          </View>
          <View style={styles.progressTrack} accessibilityRole="progressbar">
            {PROGRESS_STEPS.map((label, index) => {
              const step = index + 1;
              const done = effectiveStage > step || (effectiveStage === 4 && step === 4);
              const current = effectiveStage === step && effectiveStage < 4;
              const active = done || current;
              const lineBeforeActive = effectiveStage >= step;
              const lineAfterActive = effectiveStage > step;
              return (
                <View key={label} style={styles.progressStep}>
                  <View style={styles.progressTopRow}>
                    <View
                      style={[
                        styles.progressLine,
                        index === 0 && styles.progressLineHidden,
                        lineBeforeActive && styles.progressLineActive,
                      ]}
                    />
                    <View
                      style={[
                        styles.progressNode,
                        done && styles.progressNodeDone,
                        current && styles.progressNodeCurrent,
                      ]}
                    >
                      {done ? (
                        <MaterialCommunityIcons name="check" size={13} color={colors.ink} />
                      ) : (
                        <Text style={[styles.progressStepNum, active && styles.progressStepNumActive]}>
                          {step}
                        </Text>
                      )}
                    </View>
                    <View
                      style={[
                        styles.progressLine,
                        index === PROGRESS_STEPS.length - 1 && styles.progressLineHidden,
                        lineAfterActive && styles.progressLineActive,
                      ]}
                    />
                  </View>
                  <Text
                    style={[styles.progressLabel, active && styles.progressLabelActive]}
                    numberOfLines={2}
                  >
                    {label}
                  </Text>
                </View>
              );
            })}
          </View>
          {effectiveStage === 0 ? (
            <Text style={styles.hint}>
              目前沒有進行中的需求單，跟分身聊聊想做什麼，建立後會顯示進度。
            </Text>
          ) : effectiveStage === 4 ? (
            <>
              <Text style={styles.hint}>這筆偷揪已成立！想再找下一次可以點擊下方按鈕重新開始。</Text>
              <PrimaryButton
                loading={cancelling}
                onPress={async () => {
                  await onRestartStealth?.();
                  restart();
                  setRequestPanel(false);
                }}
              >
                再偷揪一單
              </PrimaryButton>
            </>
          ) : (
            <>
              <Text style={styles.hint}>
                {effectiveStage === 3
                  ? '雙方已進入聊聊中，這筆需求單不會再與其他需求配對。偷揪成立前若要重新對話，請先取消需求單。'
                  : effectiveStage === 2
                    ? '已找到偷揪夥伴，等待雙方同意聊聊。偷揪成立前若要重新跟分身對話，請先取消需求單。'
                    : '正在尋找合適的偷揪夥伴中。偷揪成立前若要重新跟分身對話，請先取消這筆需求單。'}
              </Text>
              {activeSignal && onCancelActiveSignal ? (
                <PrimaryButton
                  secondary
                  loading={cancelling}
                  onPress={() => {
                    void onCancelActiveSignal();
                  }}
                >
                  取消需求單
                </PrimaryButton>
              ) : null}
            </>
          )}
        </View>
      ) : null}
      <View style={styles.composer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="查看目前需求單進度"
          accessibilityState={{ expanded: requestPanel }}
          onPress={() => setRequestPanel((open) => !open)}
          style={styles.voice}
        >
          <MaterialCommunityIcons
            name="clipboard-text-outline"
            size={22}
            color={requestPanel ? colors.ink : colors.muted}
          />
          {effectiveStage > 0 ? <View style={styles.requestDot} /> : null}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="用語音回答"
          disabled={disabled || busy || chatLocked}
          onPress={() => {
            void speak();
          }}
          style={styles.voice}
        >
          <MaterialCommunityIcons
            name="microphone-outline"
            size={23}
            color={busy || disabled || chatLocked ? colors.subtle : colors.ink}
          />
        </Pressable>
        <ChatTextInput
          emptyCentered
          accessibilityLabel="跟偷揪分身聊天"
          placeholder={
            chatLocked
              ? '目前有進行中的需求單，欲重新對話請先取消需求單'
              : reviewing && pendingSignal && !saved
                ? '請輸入「同意」或「不同意」'
                : '說說你的想法'
          }
          value={text}
          onChangeText={(value) => {
            if (saved) restart();
            setText(value);
          }}
          multiline
          maxLength={1000}
          editable={!busy && !disabled && !chatLocked}
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={voiceReview ? '送出語音文字' : '傳送給分身'}
          accessibilityState={{ busy: phase === 'interview' }}
          disabled={disabled || busy || chatLocked || !inputValid}
          onPress={() => {
            submitInput(text);
          }}
          style={[styles.send, (disabled || busy || chatLocked || !inputValid) && styles.disabled]}
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
            submitInput(text);
          }}
        >
          確認文字並送出
        </PrimaryButton>
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
    gap: 10,
    flex: 1,
    minHeight: 0,
  },
  panelHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  voiceToggle: { minWidth: 38, minHeight: 38, alignItems: 'center', justifyContent: 'center' },
  inChatCardBlock: {
    alignSelf: 'flex-start',
    width: '100%',
    maxWidth: 350,
    gap: 10,
  },
  name: { fontSize: 15, fontWeight: '800', color: colors.ink },
  hint: { fontSize: 12, lineHeight: 19, color: colors.muted },
  transcript: { flex: 1, minHeight: 0 },
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
    backgroundColor: colors.surface,
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
  requestDot: {
    position: 'absolute',
    top: 7,
    right: 4,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.yellow,
  },
  requestPanel: {
    gap: 10,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  requestPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressTrack: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 4,
  },
  progressStep: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  progressTopRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.border,
  },
  progressLineHidden: {
    backgroundColor: 'transparent',
  },
  progressLineActive: {
    backgroundColor: colors.yellow,
  },
  progressNode: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressNodeDone: {
    borderColor: colors.yellow,
    backgroundColor: colors.yellow,
  },
  progressNodeCurrent: {
    borderColor: colors.yellow,
    backgroundColor: colors.yellowSoft,
  },
  progressStepNum: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
  },
  progressStepNumActive: {
    color: colors.ink,
  },
  progressLabel: {
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
    color: colors.muted,
    paddingHorizontal: 2,
  },
  progressLabelActive: {
    color: colors.ink,
    fontWeight: '700',
  },
  choicePrimary: { ...yellowSurface, backgroundColor: colors.yellowSoft },
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
    ...yellowSurface,
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
    ...yellowSurface,
    backgroundColor: colors.yellowSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallButton: { padding: 4 },
  voicePanel: { gap: 10 },
  voiceReviewHeading: { gap: 4, paddingTop: 4 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 21 },
});
