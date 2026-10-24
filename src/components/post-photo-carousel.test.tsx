import { expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { PhotoCarousel, photoFrame } from './post-photo-carousel';

jest.mock('@/components/core-post-image', () => ({ CorePostImage: () => null }));
jest.mock('@/lib/font-size-storage', () => ({
  fontSizeStorage: { getItem: () => null, setItem: jest.fn(), removeItem: jest.fn() },
}));
const photos = [
  { id: 'portrait', uri: 'test://portrait', width: 800, height: 1200 },
  { id: 'landscape', uri: 'test://landscape', width: 1200, height: 800 },
  { id: 'third', uri: 'test://third', width: 1000, height: 1000 },
  { id: 'fourth', uri: 'test://fourth', width: 1000, height: 1000 },
  { id: 'fifth', uri: 'test://fifth', width: 1000, height: 1000 },
];
it('preserves portrait and landscape ratios at the same fixed height without limiting width', () => {
  expect(photoFrame(360, photos[0])).toEqual({ width: 200, height: 300 });
  expect(photoFrame(360, photos[1])).toEqual({ width: 450, height: 300 });
  expect(photoFrame(160, photos[1])).toEqual({ width: 450, height: 300 });
  expect(photoFrame(360, photos[0], true)).toEqual({ width: 120, height: 180 });
});
it('renders all five complete photos in a scrollable rail with gaps and individual rounded corners', async () => {
  const screen = await render(<PhotoCarousel photos={photos} />);
  const scroll = screen.getByTestId('post-photo-scroll');
  expect(scroll.props.horizontal).toBe(true);
  expect(scroll.props.pagingEnabled).toBeUndefined();
  expect(scroll.props.contentContainerStyle.gap).toBe(8);
  expect(screen.getByLabelText('貼文照片 5')).toBeTruthy();
  expect(screen.getByLabelText('貼文照片 2').props.resizeMode).toBe('contain');
  expect(
    StyleSheet.flatten(screen.getByRole('button', { name: '查看照片 2' }).props.style),
  ).toMatchObject({ width: 450, height: 300, borderRadius: 16 });
});
it('opens original photos without replacing the horizontal feed with a cropped grid', async () => {
  const screen = await render(<PhotoCarousel photos={photos} />);
  await fireEvent.press(screen.getByRole('button', { name: '查看照片 5' }));
  expect(screen.getByRole('button', { name: '關閉照片' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: '關閉照片' }));
  expect(screen.queryByRole('button', { name: '關閉照片' })).toBeNull();
});
