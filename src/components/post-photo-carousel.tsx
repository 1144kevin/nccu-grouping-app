import { useRef, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  dark = false,
}: {
  photo: PostPhoto;
  index: number;
  height: number;
  fit: 'cover' | 'contain';
  dark?: boolean;
}) {
  return photo.uri ? (
    <Image
      accessibilityLabel={`貼文照片 ${index + 1}`}
      source={{ uri: photo.uri }}
      resizeMode={fit}
      style={{ width: '100%', height }}
    />
  ) : (
    <CorePostImage
      imageId={photo.id}
      frameHeight={height}
      fit={fit}
      backgroundColor={dark ? '#000000' : undefined}
    />
  );
}

// Kept as the shared gallery entry point for feed, search and order screens.
export function PhotoCarousel({
  photos,
  compact = false,
  shareMessage,
}: {
  photos: PostPhoto[];
  shareMessage?: string;
  compact?: boolean;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  if (!photos.length) return null;
  const height = compact ? 180 : 300;
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
              style={[styles.cell, photo.width > 0 ? frame : { height }]}
            >
              {photo.width > 0 || photo.uri ? (
                <Photo photo={photo} index={index} height={height} fit="contain" />
              ) : (
                <CorePostImage imageId={photo.id} intrinsicHeight={height} />
              )}
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
          <PhotoViewer
            key={`${photos[selected]?.id}-${selected}`}
            photos={photos}
            initialIndex={selected}
            shareMessage={shareMessage}
            onClose={() => setSelected(null)}
          />
        ) : null}
      </Modal>
    </View>
  );
}

// Explicitly position after layout/content measurement: contentOffset alone is
// ignored on the initial mount by React Native Web's ScrollView.
function PhotoViewer({
  photos,
  initialIndex,
  onClose,
  shareMessage,
}: {
  photos: PostPhoto[];
  initialIndex: number;
  shareMessage?: string;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollView>(null);
  const currentIndex = useRef(initialIndex);
  const [active, setActive] = useState(initialIndex);
  const positionedWidth = useRef(0);
  const viewerWidth = Math.max(1, width);
  const viewerHeight = Math.max(
    100,
    height - Math.max(24, insets.top) - Math.max(24, insets.bottom) - 128,
  );
  const position = () => {
    if (positionedWidth.current === viewerWidth) return;
    scroll.current?.scrollTo({ x: currentIndex.current * viewerWidth, y: 0, animated: false });
  };
  const share = () => {
    void Share.share({
      message: shareMessage ?? '政缺一咖拼單照片',
      ...(photos[active]?.uri && !photos[active].uri!.startsWith('data:')
        ? { url: photos[active].uri }
        : {}),
    });
  };
  return (
    <View testID="photo-viewer" style={styles.viewer} accessibilityViewIsModal>
      <View style={[styles.viewerHeader, { paddingTop: Math.max(24, insets.top) }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="關閉照片"
          onPress={onClose}
          style={styles.viewerControl}
        >
          <MaterialCommunityIcons name="close" size={26} color="#FFFFFF" />
        </Pressable>
        {shareMessage ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="分享貼文"
            onPress={share}
            style={styles.viewerControl}
          >
            <MaterialCommunityIcons name="share-variant-outline" size={22} color="#FFFFFF" />
          </Pressable>
        ) : null}
      </View>
      <ScrollView
        ref={scroll}
        testID="photo-viewer-scroll"
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        contentOffset={{ x: initialIndex * viewerWidth, y: 0 }}
        onLayout={position}
        onContentSizeChange={() => {
          position();
          positionedWidth.current = viewerWidth;
        }}
        onScroll={(event) => {
          if (positionedWidth.current !== viewerWidth) return;
          const index = Math.max(
            0,
            Math.min(
              photos.length - 1,
              Math.round(event.nativeEvent.contentOffset.x / viewerWidth),
            ),
          );
          currentIndex.current = index;
          setActive(index);
        }}
        scrollEventThrottle={80}
        style={{ width: viewerWidth, height: viewerHeight, flexGrow: 0 }}
      >
        {photos.map((photo, index) => (
          <View
            key={photo.id}
            style={{ width: viewerWidth, height: viewerHeight, justifyContent: 'center' }}
          >
            <Photo photo={photo} index={index} height={viewerHeight} fit="contain" dark />
          </View>
        ))}
      </ScrollView>
      <View style={[styles.viewerFooter, { paddingBottom: Math.max(24, insets.bottom) }]}>
        <Text accessibilityLiveRegion="polite" style={styles.viewerHint}>
          {active + 1} / {photos.length}
        </Text>
      </View>
    </View>
  );
}

export function CorePostGallery({
  post,
  compact = false,
}: {
  post: Pick<CorePost, 'images' | 'image_id'> & Partial<Pick<CorePost, 'content'>>;
  compact?: boolean;
}) {
  const shareMessage = post.content ? `政缺一咖拼單：${post.content}` : undefined;
  if (post.images?.length)
    return <PhotoCarousel photos={post.images} compact={compact} shareMessage={shareMessage} />;
  return post.image_id ? (
    <PhotoCarousel
      photos={[{ id: post.image_id, width: 0, height: 0 }]}
      compact={compact}
      shareMessage={shareMessage}
    />
  ) : null;
}

const styles = StyleSheet.create({
  container: { width: '100%', marginVertical: 8 },
  rail: { gap: 8 },
  cell: { flexShrink: 0, overflow: 'hidden', borderRadius: 16, backgroundColor: colors.surface },
  viewer: { flex: 1, backgroundColor: '#000000' },
  viewerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  viewerControl: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#202020',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingTop: 20,
    minHeight: 72,
  },
  viewerHint: { color: '#FFFFFF', fontSize: 14 },
});
