import { PageLoading } from '@/components/page-loading';
import { useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/app-text';
import { PrimaryButton } from '@/components/primitives';
import { coreError } from '@/lib/core-api';
import { useCoreScreenFocused } from '@/lib/core-hooks';
import { mediaApi, trustedImageLink, type DraftImage } from '@/lib/media-api';
import { queryClient } from '@/lib/query-client';
import { useAuthStore } from '@/store/auth-store';
import { colors, radius, spacing } from '@/theme/tokens';

export function CorePostImage({
  ...props
}: {
  imageId: string;
  compact?: boolean;
  frameHeight?: number;
  fit?: 'contain' | 'cover';
  intrinsicHeight?: number;
  backgroundColor?: string;
}) {
  const actor = useAuthStore((state) => state.user?.id);
  return <SignedPostImage key={`${actor}:${props.imageId}`} {...props} actor={actor} />;
}

function SignedPostImage({
  imageId,
  compact = false,
  frameHeight,
  fit = 'contain',
  intrinsicHeight,
  backgroundColor,
  actor,
}: {
  imageId: string;
  compact?: boolean;
  frameHeight?: number;
  fit?: 'contain' | 'cover';
  intrinsicHeight?: number;
  backgroundColor?: string;
  actor?: string;
}) {
  const focused = useCoreScreenFocused();
  const [failedAttempt, setFailedAttempt] = useState<string | null>(null);
  const automaticRefreshes = useRef(0);
  const query = useQuery({
    queryKey: ['core', actor, 'image-link', imageId],
    queryFn: async () => {
      const link = await mediaApi.link(imageId);
      return { ...link, url: trustedImageLink(link.url) };
    },
    enabled: !!actor && focused,
    retry: false,
    staleTime: 45_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    gcTime: 0,
  });
  const attempt = `${query.data?.url}:${query.dataUpdatedAt}`;
  const failed = failedAttempt === attempt;
  const intrinsicWidth =
    intrinsicHeight && query.data
      ? (intrinsicHeight * query.data.width) / query.data.height
      : intrinsicHeight;
  return (
    <View
      style={[
        styles.imageWrap,
        frameHeight
          ? { height: frameHeight, marginVertical: 0, minHeight: 0, borderRadius: 0 }
          : intrinsicHeight
            ? {
                width: intrinsicWidth,
                height: intrinsicHeight,
                marginVertical: 0,
                minHeight: 0,
                borderRadius: 16,
              }
            : compact && { minHeight: 120 },
        backgroundColor ? { backgroundColor } : null,
      ]}
    >
      {!focused || query.isPending || query.isFetching ? (
        <PageLoading accessibilityLabel="正在載入拼單圖片" />
      ) : query.data && !failed ? (
        <Image
          key={attempt}
          accessibilityLabel="拼單附圖"
          source={{ uri: query.data.url }}
          cachePolicy="memory"
          contentFit={fit}
          onLoad={() => {
            automaticRefreshes.current = 0;
          }}
          onError={() => {
            setFailedAttempt(attempt);
            // An expired cached URL or a transient image download gets one fresh
            // signed link automatically; a genuine failure keeps an explicit retry.
            if (automaticRefreshes.current === 0) {
              automaticRefreshes.current = 1;
              void query.refetch();
            }
          }}
          style={
            frameHeight || intrinsicHeight
              ? { width: '100%', height: frameHeight ?? intrinsicHeight }
              : {
                  width: '100%',
                  aspectRatio: query.data.width / query.data.height,
                  maxHeight: compact ? 180 : 450,
                }
          }
        />
      ) : (
        <View style={styles.note}>
          <Text style={styles.hint}>
            {query.error ? coreError(query.error) : '圖片暫時無法顯示，文字拼單仍可使用。'}
          </Text>
          <PrimaryButton
            secondary
            disabled={query.isFetching}
            onPress={() => {
              setFailedAttempt(null);
              automaticRefreshes.current = 0;
              void query.refetch();
            }}
          >
            重試圖片
          </PrimaryButton>
        </View>
      )}
    </View>
  );
}

export function DraftImageManager() {
  const actor = useAuthStore((state) => state.user?.id);
  const focused = useCoreScreenFocused();
  const query = useQuery({
    queryKey: ['core', actor, 'draft-images'],
    queryFn: mediaApi.drafts,
    enabled: !!actor && focused,
    retry: false,
  });
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>未發佈的圖片副本</Text>
      <Text style={styles.hint}>
        離開發佈頁後，可在此清除尚未綁定拼單的雲端圖片。只刪除上傳副本，不會刪手機原始照片；已發佈圖片不能在此移除。
      </Text>
      {query.isPending ? <PageLoading /> : null}
      {query.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {coreError(query.error)}
        </Text>
      ) : null}
      {query.data?.items.length === 0 ? (
        <Text style={styles.hint}>目前沒有未發佈圖片。</Text>
      ) : null}
      {query.data?.items.map((item) => (
        <DraftImageRow key={item.id} image={item} />
      ))}
      <PrimaryButton
        secondary
        disabled={query.isFetching}
        onPress={() => {
          void query.refetch();
        }}
      >
        重新載入圖片副本
      </PrimaryButton>
    </View>
  );
}
function DraftImageRow({ image }: { image: DraftImage }) {
  const actor = useAuthStore((state) => state.user?.id);
  const [confirm, setConfirm] = useState(false);
  const remove = useMutation({
    mutationFn: () => mediaApi.remove(image.id),
    onSuccess: () => {
      if (useAuthStore.getState().user?.id === actor)
        void queryClient.invalidateQueries({ queryKey: ['core', actor, 'draft-images'] });
    },
  });
  return (
    <View style={styles.note}>
      <Text style={styles.hint}>
        {new Date(image.created_at).toLocaleString('zh-TW')} · {image.width}×{image.height} ·{' '}
        {image.state === 'ready' ? '已上傳，尚未發佈' : '上傳未完成'}
      </Text>
      {confirm ? (
        <>
          <PrimaryButton secondary disabled={remove.isPending} onPress={() => remove.mutate()}>
            確認刪除這份未發佈副本
          </PrimaryButton>
          <PrimaryButton secondary disabled={remove.isPending} onPress={() => setConfirm(false)}>
            保留副本
          </PrimaryButton>
        </>
      ) : (
        <PrimaryButton secondary onPress={() => setConfirm(true)}>
          刪除未發佈副本
        </PrimaryButton>
      )}
      {remove.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {coreError(remove.error)}
        </Text>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  imageWrap: {
    width: '100%',
    minHeight: 100,
    marginVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  image: { width: '100%', height: 240 },
  note: { padding: spacing.md, gap: spacing.sm },
  panel: {
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.ink },
  hint: { fontSize: 13, lineHeight: 21, color: colors.muted },
  error: { color: colors.danger },
});
