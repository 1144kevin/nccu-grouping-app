import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppText as Text, AppTextInput as TextInput } from '@/components/app-text';
import { KeyboardScrollView } from '@/components/keyboard-layout';
import { PrimaryButton } from '@/components/primitives';
import { socialApi } from '@/lib/social-api';
import { coreError } from '@/lib/core-api';
import { startPostSpeech } from '@/lib/post-speech';
import type { SpeechCapture } from '@/lib/post-speech.types';
import { useAuthStore } from '@/store/auth-store';
import { colors, radius } from '@/theme/tokens';

type WritingProps = {
  content: string;
  context: string;
  imageBase64?: string;
  disabled: boolean;
  onApply: (text: string) => void;
  onBusyChange?: (busy: boolean) => void;
};
type Source = { content: string; context: string; imageBase64?: string; actor?: string };
type Preview = { source: Source; text: string; sourceText: string; mode: 'image' | 'voice' };
const draftLength = (text: string) => [...text.replace(/\s/g, '')].length;

export function PostWritingAssistant(props: WritingProps) {
  const actor = useAuthStore((s) => s.user?.id);
  return <WritingSession key={actor} {...props} actor={actor} />;
}
function WritingSession({
  content,
  context,
  imageBase64,
  disabled,
  onApply,
  onBusyChange,
  actor,
}: WritingProps & { actor?: string }) {
  const current = useRef<Source>({ content, context, imageBase64, actor });
  useEffect(() => {
    current.current = { content, context, imageBase64, actor };
  }, [content, context, imageBase64, actor]);
  const mounted = useRef(true);
  const generation = useRef(0);
  const capture = useRef<SpeechCapture | null>(null);
  const pendingSpeech = useRef<AbortController | null>(null);
  const running = useRef(false);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [starting, setStarting] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<Preview>();
  const [original, setOriginal] = useState<{ before: string; after: string }>();
  const locked = busy || listening || starting;
  useEffect(() => {
    onBusyChange?.(locked);
  }, [locked, onBusyChange]);
  const cancelWork = useCallback(() => {
    generation.current += 1;
    pendingSpeech.current?.abort();
    pendingSpeech.current = null;
    capture.current?.cancel();
    capture.current = null;
    running.current = false;
    setBusy(false);
    setListening(false);
    setStarting(false);
  }, []);
  useFocusEffect(
    useCallback(
      () => () => {
        cancelWork();
      },
      [cancelWork],
    ),
  );
  useEffect(() => {
    mounted.current = true;
    const listener = AppState.addEventListener('change', (state) => {
      // Permission dialogs temporarily mark iOS inactive; allow them to finish.
      if (state === 'background') cancelWork();
    });
    return () => {
      mounted.current = false;
      generation.current += 1;
      pendingSpeech.current?.abort();
      capture.current?.cancel();
      listener.remove();
      onBusyChange?.(false);
    };
  }, [cancelWork, onBusyChange]);
  const alive = (id: number) =>
    mounted.current && generation.current === id && useAuthStore.getState().user?.id === actor;
  const sourceMatches = (source: Source) =>
    source.actor === actor &&
    source.content === current.current.content &&
    source.context === current.current.context &&
    source.imageBase64 === current.current.imageBase64;

  async function generate(
    mode: 'image' | 'voice',
    source: Source,
    spoken = '',
    id = ++generation.current,
  ) {
    if (!alive(id)) return;
    running.current = true;
    setBusy(true);
    setError('');
    setPreview(undefined);
    try {
      const result = await socialApi.writePost(
        mode,
        mode === 'voice' ? spoken : source.content,
        source.context,
        mode === 'image' ? source.imageBase64 : undefined,
      );
      if (!alive(id)) return;
      if (!sourceMatches(source)) {
        setError('照片或表單已變更，請重新生成。');
        return;
      }
      if (draftLength(result.text) < 50 || [...result.text].length > 500)
        throw new Error('post_writing_invalid_output');
      setPreview({ source, text: result.text, sourceText: result.source_text || spoken, mode });
      setVoiceOpen(false);
    } catch (e) {
      if (alive(id)) setError(coreError(e));
    } finally {
      if (alive(id)) {
        running.current = false;
        setBusy(false);
      }
    }
  }
  async function beginVoice() {
    if (running.current || disabled || !actor) return;
    cancelWork();
    const id = ++generation.current;
    const source = { ...current.current };
    let ended = false;
    const abort = new AbortController();
    pendingSpeech.current = abort;
    running.current = true;
    setStarting(true);
    setVoiceOpen(true);
    setTranscript('');
    setError('');
    try {
      const session = await startPostSpeech(
        {
          onText: (text) => {
            if (alive(id)) setTranscript(text);
          },
          onEnd: (text) => {
            if (!alive(id)) return;
            ended = true;
            capture.current = null;
            setListening(false);
            setStarting(false);
            setTranscript(text);
            if (!text.trim()) {
              running.current = false;
              setBusy(false);
              setError('沒有辨識到語音，請再說一次。');
              return;
            }
            void generate('voice', source, text, id);
          },
          onError: (code) => {
            if (!alive(id)) return;
            ended = true;
            capture.current = null;
            running.current = false;
            setListening(false);
            setStarting(false);
            setBusy(false);
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
      setStarting(false);
      setListening(true);
    } catch (e) {
      if (alive(id)) {
        running.current = false;
        setStarting(false);
        setListening(false);
        setError(coreError(e));
      }
    }
  }
  const validPreview =
    preview &&
    preview.source.actor === actor &&
    preview.source.content === content &&
    preview.source.context === context &&
    preview.source.imageBase64 === imageBase64;
  const closeVoice = () => {
    cancelWork();
    setVoiceOpen(false);
  };
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>AI 文案助手</Text>
      <Text style={styles.hint}>照片或口述需求都能整理成完整文案，至少 50 字，採用前可編輯。</Text>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="圖片辨識生成文案"
          disabled={disabled || locked || !actor || !imageBase64}
          onPress={() => {
            if (!running.current) void generate('image', { ...current.current });
          }}
          style={[styles.button, (disabled || locked || !actor || !imageBase64) && styles.disabled]}
        >
          <MaterialCommunityIcons name="image-text" size={20} color={colors.ink} />
          <Text style={styles.buttonText}>圖片辨識生成文案</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="語音潤稿"
          disabled={disabled || locked || !actor}
          onPress={() => {
            void beginVoice();
          }}
          style={[styles.button, (disabled || locked || !actor) && styles.disabled]}
        >
          <MaterialCommunityIcons name="microphone-outline" size={20} color={colors.ink} />
          <Text style={styles.buttonText}>語音潤稿</Text>
        </Pressable>
      </View>
      {!imageBase64 ? (
        <Text style={styles.hint}>先加入照片，就能辨識宣傳單、菜單或餐點資訊。</Text>
      ) : null}
      {busy && !voiceOpen ? (
        <Text accessibilityLiveRegion="polite">正在辨識資訊並整理文案…</Text>
      ) : null}
      {error && !voiceOpen ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      {original && original.after === content ? (
        <Pressable
          accessibilityRole="button"
          disabled={disabled || locked}
          onPress={() => {
            onApply(original.before);
            setOriginal(undefined);
          }}
        >
          <Text style={styles.restore}>還原原文</Text>
        </Pressable>
      ) : null}
      <Modal visible={voiceOpen} animationType="slide" onRequestClose={closeVoice}>
        <KeyboardScrollView
          contentContainerStyle={styles.modal}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>語音潤稿</Text>
          <Text style={styles.body}>
            {starting
              ? '正在取得麥克風與語音辨識權限…'
              : listening
                ? '正在聆聽，說說想拼什麼、優惠或取餐需求。'
                : busy
                  ? '正在將口述內容整理成文案…'
                  : '可編輯辨識文字後再潤稿，或重新說一次。'}
          </Text>
          <Text style={styles.hint}>
            每次最多 60 秒。語音由裝置或系統辨識服務轉成文字，結束後文字會交給 AI 潤稿。
          </Text>
          <TextInput
            accessibilityLabel="語音辨識文字"
            multiline
            maxLength={4000}
            value={transcript}
            editable={!locked}
            onChangeText={setTranscript}
            placeholder="辨識文字會顯示在這裡"
            style={styles.editor}
          />
          {error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}
          {listening ? (
            <PrimaryButton
              onPress={() => {
                capture.current?.stop();
                setListening(false);
                setBusy(true);
              }}
            >
              結束說話並潤稿
            </PrimaryButton>
          ) : null}
          {!locked ? (
            <>
              <PrimaryButton
                disabled={!transcript.trim() || disabled}
                onPress={() => {
                  void generate('voice', { ...current.current }, transcript);
                }}
              >
                用這段文字潤稿
              </PrimaryButton>
              <PrimaryButton
                secondary
                disabled={disabled}
                onPress={() => {
                  void beginVoice();
                }}
              >
                重新說一次
              </PrimaryButton>
            </>
          ) : null}
          <PrimaryButton secondary onPress={closeVoice}>
            取消並返回
          </PrimaryButton>
        </KeyboardScrollView>
      </Modal>
      <Modal
        visible={!!validPreview}
        animationType="slide"
        onRequestClose={() => setPreview(undefined)}
      >
        <KeyboardScrollView
          contentContainerStyle={styles.modal}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>確認貼文草稿</Text>
          <Text style={styles.hint}>
            {preview?.mode === 'image' ? '照片辨識資訊，請核對優惠與限制條件' : '語音辨識內容'}
          </Text>
          <Text style={styles.body}>{preview?.sourceText}</Text>
          <Text style={styles.hint}>文案草稿 · 可編輯</Text>
          <TextInput
            accessibilityLabel="AI 貼文草稿"
            multiline
            maxLength={500}
            value={preview?.text ?? ''}
            onChangeText={(text) => setPreview((p) => (p ? { ...p, text } : p))}
            style={styles.editor}
          />
          <Text style={styles.hint}>
            {draftLength(preview?.text ?? '')} 字，至少 50 字；價格、優惠與分工請確認後再採用。
          </Text>
          <PrimaryButton
            disabled={disabled || !validPreview || draftLength(preview?.text ?? '') < 50}
            onPress={() => {
              if (!validPreview || !preview) return;
              setOriginal({ before: content, after: preview.text });
              onApply(preview.text);
              setPreview(undefined);
            }}
          >
            採用草稿
          </PrimaryButton>
          <PrimaryButton secondary onPress={() => setPreview(undefined)}>
            保留原文
          </PrimaryButton>
        </KeyboardScrollView>
      </Modal>
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: {
    gap: 8,
    marginBottom: 18,
    padding: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  title: { fontSize: 17, fontWeight: '700', color: colors.ink },
  hint: { fontSize: 13, color: colors.muted, lineHeight: 20 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.yellow,
    borderRadius: radius.md,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  disabled: { opacity: 0.4 },
  buttonText: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  error: { color: colors.danger, fontSize: 13 },
  restore: { color: colors.brown, fontSize: 13, padding: 8 },
  modal: { padding: 24, paddingTop: 60, gap: 14 },
  body: { color: colors.ink, fontSize: 16, lineHeight: 24 },
  editor: {
    minHeight: 180,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    color: colors.ink,
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: 'top',
  },
});
