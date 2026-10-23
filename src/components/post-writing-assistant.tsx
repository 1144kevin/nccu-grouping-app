import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppText as Text, AppTextInput as TextInput } from '@/components/app-text';
import { KeyboardScrollView } from '@/components/keyboard-layout';
import { PrimaryButton } from '@/components/primitives';
import { socialApi } from '@/lib/social-api';
import { coreError } from '@/lib/core-api';
import { useAuthStore } from '@/store/auth-store';
import { colors, radius } from '@/theme/tokens';

type WritingProps = {
  content: string;
  context: string;
  disabled: boolean;
  onApply: (text: string) => void;
};
export function PostWritingAssistant(props: WritingProps) {
  const actor = useAuthStore((s) => s.user?.id);
  return <WritingSession key={actor} {...props} actor={actor} />;
}
function WritingSession({
  content,
  context,
  disabled,
  onApply,
  actor,
}: WritingProps & { actor?: string }) {
  const current = useRef({ content, context, actor });
  useEffect(() => {
    current.current = { content, context, actor };
  }, [content, context, actor]);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [busy, setBusy] = useState(false);
  const [used, setUsed] = useState(false);
  if (used && !content.trim()) setUsed(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<{
    original: string;
    context: string;
    actor?: string;
    text: string;
  }>();
  const [original, setOriginal] = useState<{ before: string; after: string; actor?: string }>();
  async function run() {
    if (!content.trim() || busy || disabled || used || !actor) return;
    const source = { ...current.current };
    setBusy(true);
    setError('');
    try {
      const result = await socialApi.writePost('generate', source.content, source.context);
      if (!mounted.current || useAuthStore.getState().user?.id !== source.actor) return;
      if (
        current.current.content !== source.content ||
        current.current.context !== source.context
      ) {
        setError('內容已變更，請重新生成。');
        return;
      }
      setUsed(true);
      setPreview({
        original: source.content,
        context: source.context,
        actor: source.actor,
        text: result.text,
      });
    } catch (e) {
      if (mounted.current && useAuthStore.getState().user?.id === source.actor)
        setError(coreError(e));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  const validPreview =
    preview &&
    preview.actor === actor &&
    preview.original === content &&
    preview.context === context;
  return (
    <View style={styles.wrap}>
      <View style={styles.strip}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>AI</Text>
          <Text style={styles.hint}>
            {busy
              ? '正在整理草稿…'
              : used
                ? '此篇已生成一次，可直接編輯內容'
                : '每篇生成一次，採用前請確認內容'}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="AI 生成貼文"
          disabled={disabled || busy || used || !actor || !content.trim()}
          onPress={() => {
            void run();
          }}
          style={[
            styles.button,
            (disabled || busy || used || !actor || !content.trim()) && { opacity: 0.4 },
          ]}
        >
          <MaterialCommunityIcons name="creation" size={16} color={colors.ink} />
          <Text style={styles.buttonText}>{used ? '已生成' : '生成'}</Text>
        </Pressable>
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      {original && original.actor === actor && original.after === content ? (
        <Pressable
          accessibilityRole="button"
          disabled={disabled || busy}
          onPress={() => {
            onApply(original.before);
            setOriginal(undefined);
          }}
        >
          <Text style={styles.restore}>還原原文</Text>
        </Pressable>
      ) : null}
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
          <Text style={styles.hint}>原文</Text>
          <Text style={styles.body}>{preview?.original}</Text>
          <Text style={styles.hint}>草稿 · 可編輯</Text>
          <TextInput
            accessibilityLabel="AI 貼文草稿"
            multiline
            maxLength={500}
            value={preview?.text ?? ''}
            onChangeText={(text) => setPreview((p) => (p ? { ...p, text } : p))}
            style={styles.editor}
          />
          <PrimaryButton
            disabled={disabled || !validPreview || !preview?.text.trim()}
            onPress={() => {
              if (!validPreview || !preview) return;
              setOriginal({ before: content, after: preview.text, actor });
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
  wrap: { gap: 6, marginBottom: 14 },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: radius.md,
  },
  title: { fontSize: 17, fontWeight: '700', color: colors.ink },
  hint: { fontSize: 12, color: colors.muted, marginTop: 3 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.yellow,
    borderRadius: 22,
    minHeight: 34,
    paddingHorizontal: 12,
  },
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
