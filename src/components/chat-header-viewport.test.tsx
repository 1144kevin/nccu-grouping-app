import { afterEach, expect, it, jest } from '@jest/globals';
import { act, render } from '@testing-library/react-native';
import { Platform, StyleSheet } from 'react-native';
import { Screen } from './primitives';

const originalPlatform = Platform.OS;
afterEach(() => {
  Platform.OS = originalPlatform;
  delete (window as unknown as { visualViewport?: unknown }).visualViewport;
});

it('keeps the chat viewport fixed at the top as the keyboard changes its height', async () => {
  Platform.OS = 'web';
  let resize = () => {};
  const viewport = {
    height: 800,
    offsetTop: 0,
    addEventListener: (type: string, fn: () => void) => {
      if (type === 'resize') resize = fn;
    },
    removeEventListener: jest.fn(),
  };
  Object.defineProperty(window, 'visualViewport', { value: viewport, configurable: true });
  const screen = await render(<Screen pinKeyboardHeader />);
  const style = () => StyleSheet.flatten(screen.getByTestId('fixed-chat-screen').props.style);
  expect(style()).toEqual(expect.objectContaining({ position: 'fixed', top: 0, height: 800 }));
  await act(() => {
    viewport.height = 430;
    viewport.offsetTop = 60;
    resize();
  });
  expect(style()).toEqual(expect.objectContaining({ position: 'fixed', top: 0, height: 430 }));
  await act(() => {
    viewport.height = 800;
    viewport.offsetTop = 0;
    resize();
  });
  expect(style()).toEqual(expect.objectContaining({ position: 'fixed', top: 0, height: 800 }));
});
