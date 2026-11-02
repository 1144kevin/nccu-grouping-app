import * as ImagePicker from 'expo-image-picker';
import { validPickedImage } from './media-api';
import { pickPostImages } from './pick-post-images';
export async function pickPersonalImage(camera = false) {
  if (!camera) return (await pickPostImages(1)).assets[0] ?? null;
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) throw new Error('image_permission_required');
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    base64: true,
    quality: 0.85,
    allowsEditing: false,
  });
  const asset = result.assets?.[0];
  return asset
    ? { ...asset, base64: validPickedImage(asset.base64, asset.width, asset.height) }
    : null;
}
