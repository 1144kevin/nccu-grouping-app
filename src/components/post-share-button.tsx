import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppText as Text, AppTextInput as TextInput } from '@/components/app-text';
import { PrimaryButton } from '@/components/primitives';
import { postSharingApi } from '@/lib/post-sharing';
import { useAuthStore } from '@/store/auth-store';
import { colors, radius, spacing } from '@/theme/tokens';

export function PostShareButton({
  postId,
  content,
  dark = false,
}: {
  postId: string;
  content: string;
  dark?: boolean;
}) {
  const actor = useAuthStore((s) => s.user?.id);
  const [visible, setVisible] = useState(false);
  const [notice, setNotice] = useState('');
  const [openedBy, setOpenedBy] = useState<string>();
  const link = useMutation({ mutationFn: () => postSharingApi.create(postId) });
  const url = link.data;
  async function action(work: () => Promise<unknown>) {
    setNotice('');
    try {
      await work();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      setNotice('目前無法完成分享，請長按下方連結複製。');
    }
  }
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="分享貼文"
        style={[styles.icon, dark && styles.darkIcon]}
        onPress={() => {
          setNotice('');
          setOpenedBy(actor);
          setVisible(true);
          link.mutate();
        }}
      >
        <MaterialCommunityIcons
          name="share-variant-outline"
          size={22}
          color={dark ? '#FFFFFF' : colors.ink}
        />
      </Pressable>
      <Modal
        visible={visible && openedBy === actor}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.panel} accessibilityViewIsModal>
            <Text style={styles.title}>分享這篇貼文</Text>
            {link.isPending ? (
              <ActivityIndicator color={colors.muted} accessibilityLabel="正在建立分享連結" />
            ) : url && !link.error ? (
              <>
                <Text style={styles.hint}>朋友點開連結就能看貼文，登入後即可一起拼單。</Text>
                <PrimaryButton
                  onPress={() => {
                    void action(() =>
                      Linking.openURL(`https://line.me/R/share?text=${encodeURIComponent(url)}`),
                    );
                  }}
                >
                  分享到 LINE
                </PrimaryButton>
                <PrimaryButton
                  secondary
                  onPress={() => {
                    void action(() =>
                      Share.share({ title: '政缺一咖', message: content.slice(0, 80), url }),
                    );
                  }}
                >
                  分享連結
                </PrimaryButton>
                {Platform.OS === 'web' ? (
                  <PrimaryButton
                    secondary
                    onPress={() => {
                      void action(async () => {
                        await window.navigator.clipboard.writeText(url);
                        setNotice('連結已複製');
                      });
                    }}
                  >
                    複製連結
                  </PrimaryButton>
                ) : null}
                <TextInput
                  accessibilityLabel="貼文分享連結"
                  value={url}
                  editable={false}
                  selectTextOnFocus
                  style={styles.link}
                />
              </>
            ) : (
              <Text accessibilityRole="alert">目前無法分享這篇貼文，請稍後重試。</Text>
            )}
            {notice ? (
              <Text accessibilityLiveRegion="polite" style={styles.hint}>
                {notice}
              </Text>
            ) : null}
            <PrimaryButton secondary onPress={() => setVisible(false)}>
              關閉分享
            </PrimaryButton>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  darkIcon: { backgroundColor: '#202020' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  panel: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: 12,
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.ink },
  hint: { fontSize: 14, lineHeight: 21, color: colors.muted },
  link: {
    fontSize: 12,
    color: colors.muted,
    padding: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
  },
});
