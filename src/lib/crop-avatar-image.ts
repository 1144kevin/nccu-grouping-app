import type { PickedPostImage } from './pick-post-images';

export async function cropAvatarImage(
  image: PickedPostImage,
): Promise<PickedPostImage | null> {
  return image;
}
