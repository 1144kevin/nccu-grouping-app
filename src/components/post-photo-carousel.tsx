import { useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { AppText as Text } from '@/components/app-text';
import { CorePostImage } from '@/components/core-post-image';
import type { CorePost } from '@/lib/core-api';
import { colors } from '@/theme/tokens';

export type PostPhoto = { id: string; uri?: string; width: number; height: number };

// Every photo shares a fixed height; its width follows the original aspect ratio.
export function photoFrame(
  _width: number,
  photo: Pick<PostPhoto, 'width' | 'height'>,
  compact = false,
) {
  const height = compact ? 180 : 300;
  const ratio = photo.width > 0 && photo.height > 0 ? photo.width / photo.height : 1;
  return { width: height * ratio, height };
}

function Photo({
  photo,
  index,
  height,
  fit,
}: {
  photo: PostPhoto;
  index: number;
  height: number;
  fit: 'cover' | 'contain';
}) {
  return photo.uri ? (
    <Image
      accessibilityLabel={`貼文照片 ${index + 1}`}
      source={{ uri: photo.uri }}
      resizeMode={fit}
      style={{ width: '100%', height }}
    />
  ) : (
    <CorePostImage imageId={photo.id} frameHeight={height} fit={fit} />
  );
}

// Kept as the shared gallery entry point for feed, search and order screens.
export function PhotoCarousel({
  photos,
  compact = false,
}: {
  photos: PostPhoto[];
  compact?: boolean;
}) {
  const window = useWindowDimensions();
  const [selected, setSelected] = useState<number | null>(null);
  if (!photos.length) return null;
  const height = compact ? 180 : 300;
  const viewerWidth = Math.max(1, window.width - 32);
  const viewerHeight = Math.max(100, window.height * 0.7);
  return (
    <View testID="post-photo-carousel" style={styles.container}>
      <ScrollView
        testID="post-photo-scroll"
        horizontal
        showsHorizontalScrollIndicator={false}
        nestedScrollEnabled
        directionalLockEnabled
        keyboardShouldPersistTaps="handled"
        style={{ height, flexGrow: 0 }}
        contentContainerStyle={styles.rail}
      >
        {photos.map((photo, index) => {
          const frame = photoFrame(0, photo, compact);
          return (
            <Pressable
              key={photo.id}
              accessibilityRole="button"
              accessibilityLabel={`查看照片 ${index + 1}`}
              onPress={() => setSelected(index)}
              style={[styles.cell, frame]}
            >
              <Photo photo={photo} index={index} height={height} fit="contain" />
            </Pressable>
          );
        })}
      </ScrollView>
      <Modal
        visible={selected !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        {selected !== null ? (
          <View style={styles.viewer} accessibilityViewIsModal>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="關閉照片"
              onPress={() => setSelected(null)}
              style={styles.close}
            >
              <Text style={styles.closeText}>關閉</Text>
            </Pressable>
            <ScrollView
              key={`${selected}-${viewerWidth}`}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              contentOffset={{ x: selected * viewerWidth, y: 0 }}
              style={{ width: viewerWidth, flexGrow: 0 }}
            >
              {photos.map((photo, index) => (
                <View key={photo.id} style={{ width: viewerWidth, height: viewerHeight }}>
                  <Photo photo={photo} index={index} height={viewerHeight} fit="contain" />
                </View>
              ))}
            </ScrollView>
            <Text style={styles.viewerHint}>{photos.length} 張照片 · 左右滑動查看原圖</Text>
          </View>
        ) : null}
      </Modal>
    </View>
  );
}

export function CorePostGallery({
  post,
  compact = false,
}: {
  post: Pick<CorePost, 'images' | 'image_id'>;
  compact?: boolean;
}) {
  if (post.images?.length) return <PhotoCarousel photos={post.images} compact={compact} />;
  return post.image_id ? (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ height: compact ? 180 : 300, flexGrow: 0, marginVertical: 8 }}
    >
      <CorePostImage imageId={post.image_id} intrinsicHeight={compact ? 180 : 300} />
    </ScrollView>
  ) : null;
}

const styles = StyleSheet.create({
  container: { width: '100%', marginVertical: 8 },
  rail: { gap: 8 },
  cell: { flexShrink: 0, overflow: 'hidden', borderRadius: 16, backgroundColor: colors.surface },
  viewer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  close: {
    alignSelf: 'flex-end',
    minHeight: 44,
    minWidth: 64,
    marginRight: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: { color: '#FFFFFF', fontSize: 16 },
  viewerHint: { color: '#FFFFFF', fontSize: 13, marginTop: 12 },
});
