import * as ImagePicker from 'expo-image-picker';
import { validPickedImage } from '@/lib/media-api';
export type PickedPostImage = {
  uri: string;
  base64?: string | null;
  width: number;
  height: number;
};
export async function pickPostImages(
  limit: number,
): Promise<{ canceled: boolean; assets: PickedPostImage[] }> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('image_permission_required');
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.85,
    allowsEditing: false,
    allowsMultipleSelection: limit > 1,
    orderedSelection: limit > 1,
    selectionLimit: limit,
    base64: true,
  });
  return {
    canceled: result.canceled,
    assets: (result.assets ?? []).map((asset) => ({
      ...asset,
      base64: validPickedImage(asset.base64, asset.width, asset.height),
    })),
  };
}
