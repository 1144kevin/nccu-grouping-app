/** @jest-environment jsdom */
import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { captureOrderPhoto } from './capture-order-photo.web';

jest.mock('@/lib/media-api', () => ({
  validPickedImage: (base64: string) => base64,
}));

// Prevent Expo's native fetch getter from initializing during jsdom teardown.
Object.defineProperty(globalThis, 'fetch', {
  configurable: true,
  writable: true,
  value: jest.fn(),
});

let stopTrack: ReturnType<typeof jest.fn>;
let drawImage: ReturnType<typeof jest.fn>;
let frameDataUrl = 'data:image/jpeg;base64,Zmlyc3Q=';

beforeEach(() => {
  stopTrack = jest.fn();
  drawImage = jest.fn();
  frameDataUrl = 'data:image/jpeg;base64,Zmlyc3Q=';

  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    writable: true,
    value: {
      getUserMedia: jest.fn(async () => ({
        getTracks: () => [{ stop: stopTrack }],
      })),
    },
  });

  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    writable: true,
    value: jest.fn(async function (this: HTMLVideoElement) {
      Object.defineProperty(this, 'videoWidth', { configurable: true, value: 800 });
      Object.defineProperty(this, 'videoHeight', { configurable: true, value: 600 });
    }),
  });

  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    writable: true,
    value: jest.fn(() => ({ drawImage })),
  });

  Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
    configurable: true,
    writable: true,
    value: jest.fn(() => frameDataUrl),
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

it('shows a photo preview after taking a photo and allows retaking before confirming', async () => {
  let settled = false;
  const pending = captureOrderPhoto().then((value) => {
    settled = true;
    return value;
  });

  await Promise.resolve();
  await Promise.resolve();

  const video = document.querySelector('video') as HTMLVideoElement;
  const preview = document.querySelector('img[alt="拍攝照片預覽"]') as HTMLImageElement;
  expect(video.style.display).toBe('block');
  expect(preview.style.display).toBe('none');
  expect(buttonByText('拍照').style.display).not.toBe('none');
  expect(buttonByText('重拍').style.display).toBe('none');
  expect(buttonByText('使用這張照片').style.display).toBe('none');

  // Take first photo -> enters preview mode, does not resolve yet
  buttonByText('拍照').click();
  await Promise.resolve();

  expect(settled).toBe(false);
  expect(stopTrack).not.toHaveBeenCalled();
  expect(video.style.display).toBe('none');
  expect(preview.style.display).toBe('block');
  expect(preview.getAttribute('src')).toBe('data:image/jpeg;base64,Zmlyc3Q=');
  expect(buttonByText('拍照').style.display).toBe('none');
  expect(buttonByText('重拍').style.display).not.toBe('none');
  expect(buttonByText('使用這張照片').style.display).not.toBe('none');

  // Retake -> returns to live camera mode without closing stream
  buttonByText('重拍').click();
  expect(stopTrack).not.toHaveBeenCalled();
  expect(video.style.display).toBe('block');
  expect(preview.style.display).toBe('none');
  expect(buttonByText('拍照').style.display).not.toBe('none');

  // Take second photo and confirm
  frameDataUrl = 'data:image/jpeg;base64,c2Vjb25k';
  buttonByText('拍照').click();
  expect(preview.getAttribute('src')).toBe('data:image/jpeg;base64,c2Vjb25k');

  buttonByText('使用這張照片').click();
  const result = await pending;
  expect(stopTrack).toHaveBeenCalledTimes(1);
  expect(result).toEqual({
    uri: 'data:image/jpeg;base64,c2Vjb25k',
    base64: 'c2Vjb25k',
    width: 800,
    height: 600,
  });
});

it('allows cancelling from the preview screen without using the photo', async () => {
  const pending = captureOrderPhoto();
  await Promise.resolve();
  await Promise.resolve();

  buttonByText('拍照').click();
  expect(document.body.textContent).toContain('確認這張照片？');

  buttonByText('取消').click();
  const result = await pending;
  expect(result).toBeNull();
  expect(stopTrack).toHaveBeenCalledTimes(1);
});
