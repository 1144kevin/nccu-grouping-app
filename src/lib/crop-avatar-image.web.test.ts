/** @jest-environment jsdom */
import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { cropAvatarImage } from './crop-avatar-image.web';
import { pickPostImages } from './pick-post-images.web';

jest.mock('@/lib/media-api', () => ({
  validPickedImage: (base64: string) => base64,
}));

// Prevent Expo's native fetch getter from initializing during jsdom teardown.
Object.defineProperty(globalThis, 'fetch', {
  configurable: true,
  writable: true,
  value: jest.fn(),
});

let drawImage: ReturnType<typeof jest.fn>;
let fillRect: ReturnType<typeof jest.fn>;

beforeEach(() => {
  drawImage = jest.fn();
  fillRect = jest.fn();

  class FakeImage {
    naturalWidth = 1000;
    naturalHeight = 500;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_value: string) {
      Promise.resolve().then(() => this.onload?.());
    }
  }
  Object.defineProperty(window, 'Image', {
    configurable: true,
    writable: true,
    value: FakeImage,
  });

  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    writable: true,
    value: jest.fn(() => ({
      fillStyle: '',
      fillRect,
      drawImage,
    })),
  });

  Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
    configurable: true,
    writable: true,
    value: jest.fn(() => 'data:image/jpeg;base64,Y3JvcHBlZA=='),
  });
});

afterEach(() => {
  document.body.innerHTML = '';
});

function buttonByText(label: string): HTMLButtonElement {
  const buttons = Array.from(document.querySelectorAll('button'));
  const found = buttons.find((button) => button.textContent === label);
  if (!found) throw new Error(`Missing button: ${label}`);
  return found;
}

it('disables multiple selection when picking a single personal image (limit = 1)', () => {
  const clickSpy = jest
    .spyOn(HTMLInputElement.prototype, 'click')
    .mockImplementation(() => undefined);
  void pickPostImages(1);
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  expect(input).toBeTruthy();
  expect(input.multiple).toBe(false);
  input.dispatchEvent(new Event('cancel'));
  clickSpy.mockRestore();
});

it('shows circular zoom and pan controls and outputs a square cropped avatar upon confirmation', async () => {
  const pending = cropAvatarImage({
    uri: 'data:image/jpeg;base64,b3JpZw==',
    base64: 'b3JpZw==',
    width: 1000,
    height: 500,
  });

  await Promise.resolve();
  await Promise.resolve();

  expect(document.body.textContent).toContain('調整頭像位置與縮放');
  const preview = document.querySelector('img[alt="頭像裁切預覽"]') as HTMLImageElement;
  expect(preview).toBeTruthy();
  // Base scale for 1000x500 in 280x280 circle is 280/500 = 0.56 -> 560x280
  expect(preview.style.width).toBe('560px');
  expect(preview.style.height).toBe('280px');

  // Zoom in with + button
  buttonByText('＋').click();
  expect(preview.style.width).toBe('672px');

  // Confirm crop
  buttonByText('確認作為頭像').click();
  const result = await pending;
  expect(drawImage).toHaveBeenCalledTimes(1);
  expect(result).toEqual({
    uri: 'data:image/jpeg;base64,Y3JvcHBlZA==',
    base64: 'Y3JvcHBlZA==',
    width: 512,
    height: 512,
  });
});

it('returns null without applying the photo when cancelled', async () => {
  const pending = cropAvatarImage({
    uri: 'data:image/jpeg;base64,b3JpZw==',
    base64: 'b3JpZw==',
    width: 800,
    height: 800,
  });

  await Promise.resolve();
  await Promise.resolve();

  buttonByText('取消').click();
  await expect(pending).resolves.toBeNull();
  expect(drawImage).not.toHaveBeenCalled();
});
