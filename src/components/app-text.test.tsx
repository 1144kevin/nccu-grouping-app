import { beforeEach, expect, it, jest } from '@jest/globals';
import { act, render } from '@testing-library/react-native';
import { Platform, StyleSheet } from 'react-native';
import { AppText, AppTextInput } from './app-text';
import { useFontSizeStore } from '@/store/font-size-store';
import { fontSizeStorage } from '@/lib/font-size-storage';

jest.mock('@/lib/font-size-storage', () => ({
  fontSizeStorage: { getItem: jest.fn(() => null), setItem: jest.fn(), removeItem: jest.fn() },
}));

beforeEach(() => {
  useFontSizeStore.setState({ fontSize: 'standard' });
});

it('scales text and line height immediately while preserving nested text inheritance', async () => {
  const screen = await render(
    <AppText testID="outer" style={{ fontSize: 20, lineHeight: 30 }}>
      文字<AppText testID="nested">內容</AppText>
    </AppText>,
  );
  expect(StyleSheet.flatten(screen.getByTestId('outer').props.style)).toMatchObject({
    fontSize: 18,
    lineHeight: 27,
  });
  expect(StyleSheet.flatten(screen.getByTestId('nested').props.style)?.fontSize).toBeUndefined();
  await act(() => {
    useFontSizeStore.getState().setFontSize('large');
  });
  expect(StyleSheet.flatten(screen.getByTestId('outer').props.style)).toMatchObject({
    fontSize: 20,
    lineHeight: 30,
  });
});

it('scales input text but leaves decorative fixed-size text unchanged', async () => {
  const screen = await render(
    <>
      <AppText fixedSize testID="icon" style={{ fontSize: 24 }}>
        🍍
      </AppText>
      <AppTextInput testID="input" style={{ fontSize: 20 }} />
    </>,
  );
  expect(StyleSheet.flatten(screen.getByTestId('icon').props.style).fontSize).toBe(24);
  expect(StyleSheet.flatten(screen.getByTestId('input').props.style).fontSize).toBe(18);
});

it('restores a saved preference and falls back safely for invalid stored values', async () => {
  jest
    .mocked(fontSizeStorage.getItem)
    .mockReturnValueOnce(JSON.stringify({ state: { fontSize: 'small' }, version: 0 }));
  await useFontSizeStore.persist.rehydrate();
  expect(useFontSizeStore.getState().fontSize).toBe('small');
  jest
    .mocked(fontSizeStorage.getItem)
    .mockReturnValueOnce(JSON.stringify({ state: { fontSize: 'invalid' }, version: 0 }));
  await useFontSizeStore.persist.rehydrate();
  expect(useFontSizeStore.getState().fontSize).toBe('standard');
  useFontSizeStore.getState().setFontSize('large');
  expect(fontSizeStorage.setItem).toHaveBeenLastCalledWith(
    'nccu-grouping.font-size',
    JSON.stringify({ state: { fontSize: 'large' }, version: 0 }),
  );
});

it('keeps web input fonts at least 16px across preferences without auto-selecting text', async () => {
  const os = jest.replaceProperty(Platform, 'OS', 'web');
  try {
    useFontSizeStore.setState({ fontSize: 'small' });
    const screen = await render(
      <AppTextInput testID="input" selectTextOnFocus style={{ fontSize: 14, lineHeight: 18 }} />,
    );
    expect(StyleSheet.flatten(screen.getByTestId('input').props.style)).toMatchObject({
      fontSize: 16,
      lineHeight: 20,
    });
    expect(screen.getByTestId('input').props.selectTextOnFocus).toBe(false);
    await screen.rerender(<AppTextInput testID="input" style={{ fontSize: 24, lineHeight: 32 }} />);
    expect(StyleSheet.flatten(screen.getByTestId('input').props.style).fontSize).toBeCloseTo(19.68);
  } finally {
    os.restore();
  }
});
