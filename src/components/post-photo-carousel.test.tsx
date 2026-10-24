import { expect, it, jest } from '@jest/globals';
import { act, fireEvent, render } from '@testing-library/react-native';
import { PhotoCarousel, photoFrame } from './post-photo-carousel';

jest.mock('@/components/core-post-image', () => ({ CorePostImage: () => null }));
jest.mock('@/lib/font-size-storage', () => ({ fontSizeStorage: { getItem: () => null, setItem: jest.fn(), removeItem: jest.fn() } }));
const photos = [
  { id: 'portrait', uri: 'test://portrait', width: 800, height: 1200 },
  { id: 'landscape', uri: 'test://landscape', width: 1200, height: 800 },
];
it('keeps each original ratio and displays the complete photo without cover cropping', async () => {
  for (const photo of photos) {
    const frame = photoFrame(360, photo);
    expect(frame.width / frame.height).toBeCloseTo(photo.width / photo.height);
    expect(frame.height).toBeLessThanOrEqual(520);
  }
  const screen = await render(<PhotoCarousel photos={photos} />);
  await act(async () => { await fireEvent(screen.getByTestId('post-photo-carousel'), 'layout', { nativeEvent: { layout: { width: 360 } } }); });
  expect(screen.getByLabelText('待發佈的圖片預覽 1').props.resizeMode).toBe('contain');
  expect(screen.getByLabelText('待發佈的圖片預覽 2').props.resizeMode).toBe('contain');
  expect(screen.getByText('1 / 2')).toBeTruthy();
  await act(async () => { await fireEvent(screen.getByTestId('post-photo-scroll'), 'momentumScrollEnd', { nativeEvent: { contentOffset: { x: 360 } } }); });
  expect(screen.getByText('2 / 2')).toBeTruthy();
  expect(screen.getByTestId('post-photo-scroll').props.style.height).toBe(240);
});

it('resets the page after a photo is removed so the counter and visible image agree', async () => {
  const screen = await render(<PhotoCarousel photos={photos} />);
  await act(async () => { await fireEvent(screen.getByTestId('post-photo-carousel'), 'layout', { nativeEvent: { layout: { width: 360 } } }); });
  await act(async () => { await fireEvent(screen.getByTestId('post-photo-scroll'), 'momentumScrollEnd', { nativeEvent: { contentOffset: { x: 360 } } }); });
  await screen.rerender(<PhotoCarousel photos={[photos[1]]} />);
  expect(screen.queryByText('2 / 2')).toBeNull();
});
