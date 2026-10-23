import { useRef, useState, type PropsWithChildren } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AppText as Text } from '@/components/app-text';
import { IconButton, PrimaryButton } from '@/components/primitives';
import { chatPhotos, type PhotoChatKind, type SentPhoto } from '@/lib/chat-photos';
import { coreError, newRequestKey } from '@/lib/core-api';
import { validPickedImage } from '@/lib/media-api';
import { useCoreScreenFocused } from '@/lib/core-hooks';
import { useAuthStore } from '@/store/auth-store';
import { colors } from '@/theme/tokens';

type Draft = { uri: string; base64: string; key: string; imageId?: string };
export function ChatComposer({
  children,
  kind,
  threadId,
  disabled,
  onSent,
}: PropsWithChildren<{
  kind: PhotoChatKind;
  threadId: string;
  disabled?: boolean;
  onSent: (photo: SentPhoto) => unknown;
}>) {
  const actor = useAuthStore((s) => s.user?.id);
  return (
    <ComposerSession
      key={`${actor}:${kind}:${threadId}`}
      {...{ kind, threadId, disabled, onSent, actor }}
    >
      {children}
    </ComposerSession>
  );
}
function ComposerSession({
  children,
  kind,
  threadId,
  disabled,
  onSent,
  actor,
}: PropsWithChildren<{
  kind: PhotoChatKind;
  threadId: string;
  disabled?: boolean;
  onSent: (photo: SentPhoto) => unknown;
  actor?: string;
}>) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<Draft>();
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState('');
  const current = useRef<Draft | undefined>(undefined);
  const live = () => useAuthStore.getState().user?.id === actor;
  const send = useMutation({
    retry: false,
    gcTime: 0,
    mutationFn: async () => {
      const photo = current.current;
      if (!photo || !live()) return;
      if (!photo.imageId) {
        const asset = await chatPhotos.upload(photo.base64, photo.key);
        photo.imageId = asset.id;
      }
      if (!live()) return;
      const receipt = await chatPhotos.send(kind, threadId, photo.imageId, photo.key);
      return {
        ...receipt,
        image_id: photo.imageId,
        local_uri: photo.uri,
        created_at: new Date().toISOString(),
      } as SentPhoto;
    },
    onSuccess: (receipt) => {
      if (live() && receipt) {
        current.current = undefined;
        setDraft(undefined);
        void onSent(receipt);
      }
    },
  });
  async function pick() {
    if (disabled || picking || send.isPending) return;
    setPicking(true);
    setError('');
    send.reset();
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          if (live()) setError('請允許照片權限，才能選取照片。');
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        base64: true,
      });
      if (!live() || result.canceled) return;
      const asset = result.assets[0];
      const next = {
        uri: asset.uri,
        base64: validPickedImage(asset.base64, asset.width, asset.height),
        key: newRequestKey(),
      };
      current.current = next;
      setDraft(next);
    } catch (e) {
      if (live()) setError(coreError(e));
    } finally {
      if (live()) setPicking(false);
    }
  }
  async function cancel() {
    if (send.isPending) return;
    try {
      if (current.current?.imageId) await chatPhotos.remove(current.current.imageId);
      if (live()) {
        current.current = undefined;
        setDraft(undefined);
        send.reset();
      }
    } catch (e) {
      if (live()) setError(coreError(e));
    }
  }
  return (
    <>
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      <View style={[styles.footer, { paddingBottom: Math.max(24, insets.bottom + 16) }]}>
        <View style={styles.row}>
          <IconButton
            icon="image-outline"
            label="傳送照片"
            disabled={disabled || picking || send.isPending}
            onPress={() => {
              void pick();
            }}
          />
          {children}
        </View>
      </View>
      <Modal
        visible={!!draft}
        transparent
        animationType="fade"
        onRequestClose={() => {
          void cancel();
        }}
      >
        <View style={styles.overlay}>
          <View style={styles.preview}>
            <Text style={styles.title}>傳送照片</Text>
            {error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            ) : null}
            {draft ? (
              <Image source={{ uri: draft.uri }} contentFit="contain" style={styles.photo} />
            ) : null}
            {send.error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {coreError(send.error)} 照片已保留，可重試。
              </Text>
            ) : null}
            <PrimaryButton disabled={disabled || send.isPending} onPress={() => send.mutate()}>
              {send.isPending ? '傳送中…' : '傳送照片'}
            </PrimaryButton>
            <PrimaryButton
              secondary
              disabled={send.isPending}
              onPress={() => {
                void cancel();
              }}
            >
              取消
            </PrimaryButton>
          </View>
        </View>
      </Modal>
    </>
  );
}
export function ChatPhoto({ imageId, localUri }: { imageId: string; localUri?: string }) {
  const actor = useAuthStore((s) => s.user?.id);
  const focused = useCoreScreenFocused();
  const [expanded, setExpanded] = useState(false);
  const [preview] = useState(localUri);
  const photo = useQuery({
    queryKey: ['core', actor, 'chat-photo', imageId],
    queryFn: () => chatPhotos.read(imageId),
    enabled: !!actor && focused,
    retry: false,
    gcTime: 0,
    staleTime: 30_000,
  });
  const uri = photo.data ? `data:image/jpeg;base64,${photo.data.content_base64}` : preview;
  return (
    <View style={{ width: 220, maxWidth: '100%' }}>
      {uri ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="查看聊天照片"
          onPress={() => setExpanded(true)}
        >
          <Image
            accessibilityLabel="聊天照片"
            source={{ uri }}
            cachePolicy="memory"
            contentFit="contain"
            style={{ width: '100%', height: 180 }}
          />
        </Pressable>
      ) : (
        <PrimaryButton
          secondary
          disabled={photo.isFetching}
          onPress={() => {
            void photo.refetch();
          }}
        >
          {photo.isFetching ? '照片載入中…' : '重試照片'}
        </PrimaryButton>
      )}
      <Modal visible={expanded} transparent onRequestClose={() => setExpanded(false)}>
        <View style={styles.overlay}>
          <IconButton icon="close" label="關閉照片" onPress={() => setExpanded(false)} />
          <Image
            source={{ uri }}
            cachePolicy="memory"
            contentFit="contain"
            style={{ width: '100%', height: '80%' }}
          />
        </View>
      </Modal>
    </View>
  );
}
const styles = StyleSheet.create({
  footer: {
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  error: { color: colors.danger, padding: 8 },
  overlay: {
    flex: 1,
    backgroundColor: '#0009',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  preview: {
    width: '100%',
    maxWidth: 420,
    padding: 20,
    borderRadius: 16,
    backgroundColor: colors.background,
    gap: 12,
  },
  photo: { width: '100%', height: 260 },
  title: { color: colors.ink, fontSize: 18, fontWeight: '700' },
});
