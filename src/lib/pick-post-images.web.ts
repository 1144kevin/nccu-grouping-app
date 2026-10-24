import { validPickedImage } from '@/lib/media-api';
import type { PickedPostImage } from './pick-post-images';

const MAX_BYTES = 4 * 1024 * 1024;
const MAX_EDGE = 2560;
function readImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new window.Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image_format_not_supported'));
    };
    image.src = url;
  });
}
function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('invalid_image_input'))),
      'image/jpeg',
      quality,
    ),
  );
}
function asDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('invalid_image_input'));
    reader.readAsDataURL(blob);
  });
}
export async function preparePostImage(file: File): Promise<PickedPostImage> {
  let image: HTMLImageElement;
  try {
    image = await readImage(file);
  } catch {
    const header = new TextDecoder('ascii').decode(await file.slice(0, 48).arrayBuffer());
    if (!/heic|heif/i.test(file.type + file.name) && !/heic|heix|hevc|hevx|mif1|msf1/.test(header))
      throw new Error('image_format_not_supported');
    // Loaded only when the browser cannot decode an HEIC itself. No photo leaves the device here.
    const { heicTo } = await import('heic-to/csp');
    try {
      image = await readImage(await heicTo({ blob: file, type: 'image/jpeg', quality: 0.92 }));
    } catch {
      throw new Error('image_conversion_failed');
    }
  }
  const ratio = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
  let blob: Blob | undefined;
  for (let resize = 0; resize < 8; resize++) {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('invalid_image_input');
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.92, 0.82, 0.7, 0.55, 0.4]) {
      blob = await toBlob(canvas, quality);
      if (blob.size <= MAX_BYTES) break;
    }
    if (blob && blob.size <= MAX_BYTES) break;
    canvas.width = Math.max(1, Math.floor(canvas.width * 0.75));
    canvas.height = Math.max(1, Math.floor(canvas.height * 0.75));
  }
  if (!blob || blob.size > MAX_BYTES) throw new Error('image_conversion_failed');
  const uri = await asDataUrl(blob);
  const base64 = validPickedImage(uri.slice(uri.indexOf(',') + 1), canvas.width, canvas.height);
  const result = { uri, base64, width: canvas.width, height: canvas.height };
  canvas.width = canvas.height = 1;
  return result;
}

export function pickPostImages(
  limit: number,
): Promise<{ canceled: boolean; assets: PickedPostImage[] }> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.heic,.heif';
    input.multiple = true;
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener(
      'cancel',
      () => {
        input.remove();
        resolve({ canceled: true, assets: [] });
      },
      { once: true },
    );
    input.addEventListener(
      'change',
      () => {
        const files = Array.from(input.files ?? []);
        input.remove();
        if (!files.length) return resolve({ canceled: true, assets: [] });
        if (files.length > limit) return reject(new Error('too_many_post_images'));
        void (async () => {
          const assets: PickedPostImage[] = [];
          // Decode one image at a time to keep memory bounded on phones.
          for (const file of files) assets.push(await preparePostImage(file));
          resolve({ canceled: false, assets });
        })().catch(reject);
      },
      { once: true },
    );
    input.click();
  });
}
