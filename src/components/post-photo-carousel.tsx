import { useState, type ReactNode } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/app-text';
import { CorePostImage } from '@/components/core-post-image';
import type { CorePost } from '@/lib/core-api';
import { colors, radius } from '@/theme/tokens';

export type PostPhoto = { id: string; uri?: string; width: number; height: number };

export function photoFrame(width: number, photo: Pick<PostPhoto, 'width' | 'height'>, compact = false) {
  const ratio = photo.width / photo.height;
  const height = Math.min(width / ratio, compact ? 180 : 520);
  return { width: height * ratio, height };
}

type CarouselProps = {
  photos: PostPhoto[]; compact?: boolean;
  renderOverlay?: (photo: PostPhoto, index: number) => ReactNode;
};

export function PhotoCarousel(props: CarouselProps) {
  return <Carousel key={props.photos.map((p) => p.id).join(',')} {...props} />;
}

function Carousel({ photos, compact = false, renderOverlay }: CarouselProps) {
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState(0);
  const index = Math.min(active, photos.length - 1);
  if (!photos.length) return null;
  const height = width ? photoFrame(width, photos[index], compact).height : 180;
  return <View testID="post-photo-carousel" style={styles.container} onLayout={(event) => {
    const next = event.nativeEvent.layout.width;
    if (next > 0 && next !== width) { setWidth(next); setActive(0); }
  }}>
    {width > 0 ? <ScrollView testID="post-photo-scroll" key={`${width}:${photos.map((p) => p.id).join(',')}`} horizontal pagingEnabled
      showsHorizontalScrollIndicator={false} nestedScrollEnabled directionalLockEnabled
      keyboardShouldPersistTaps="handled" style={{ height }}
      onMomentumScrollEnd={(event) => setActive(Math.max(0, Math.min(photos.length - 1, Math.round(event.nativeEvent.contentOffset.x / width))))}>
      {photos.map((photo, i) => <View key={photo.id} style={{ width, height, justifyContent: 'center', alignItems: 'center' }}>
        {photo.uri ? <Image accessibilityLabel={`待發佈的圖片預覽 ${i + 1}`} source={{ uri: photo.uri }} resizeMode="contain"
          style={{ width, height }} /> : <CorePostImage imageId={photo.id} frameHeight={height} />}
        {renderOverlay?.(photo, i)}
      </View>)}
    </ScrollView> : null}
    {photos.length > 1 ? <View style={styles.indicator} pointerEvents="none">
      <Text style={styles.counter}>{index + 1} / {photos.length}</Text>
    </View> : null}
  </View>;
}

export function CorePostGallery({ post, compact = false }: {
  post: Pick<CorePost, 'images' | 'image_id'>; compact?: boolean;
}) {
  if (post.images?.length) return <PhotoCarousel key={post.images.map((p) => p.id).join(',')} photos={post.images} compact={compact} />;
  return post.image_id ? <CorePostImage imageId={post.image_id} compact={compact} /> : null;
}

const styles = StyleSheet.create({
  container: { width: '100%', marginVertical: 8, borderRadius: radius.md, overflow: 'hidden' },
  indicator: { position: 'absolute', bottom: 10, right: 10, borderRadius: 16, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: 'rgba(0,0,0,0.55)' },
  counter: { color: colors.surface, fontSize: 12, fontWeight: '700' },
});
