import { pickPersonalImage } from './pick-personal-image';
export async function captureOrderPhoto() {
  return pickPersonalImage(true);
}
