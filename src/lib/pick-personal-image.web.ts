import { preparePostImage, pickPostImages } from './pick-post-images.web';
import type { PickedPostImage } from './pick-post-images';
export async function pickPersonalImage(camera = false): Promise<PickedPostImage | null> {
  if (!camera) return (await pickPostImages(1)).assets[0] ?? null;
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.heic,.heif';
    input.setAttribute('capture', 'user');
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener(
      'cancel',
      () => {
        input.remove();
        resolve(null);
      },
      { once: true },
    );
    input.addEventListener(
      'change',
      async () => {
        const file = input.files?.[0];
        input.remove();
        try {
          resolve(file ? await preparePostImage(file) : null);
        } catch (error) {
          reject(error);
        }
      },
      { once: true },
    );
    input.click();
  });
}
