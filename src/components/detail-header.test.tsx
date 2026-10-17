import { afterEach, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';
import { DetailHeader } from './primitives';

jest.mock('expo-router', () => ({ router: { canGoBack: jest.fn(), back: jest.fn(), replace: jest.fn() } }));
jest.mock('@/lib/font-size-storage', () => ({ fontSizeStorage: { getItem: jest.fn(() => null), setItem: jest.fn(), removeItem: jest.fn() } }));
afterEach(() => { jest.clearAllMocks(); });

it('returns to home when a detail page is opened directly', async () => {
  jest.mocked(router.canGoBack).mockReturnValue(false);
  const screen = await render(<DetailHeader title="拼單聊天室" />);
  await fireEvent.press(screen.getByRole('button', { name: '返回' }));
  expect(router.replace).toHaveBeenCalledWith('/');
  expect(router.back).not.toHaveBeenCalled();
});

it('preserves navigation history when a previous screen exists', async () => {
  jest.mocked(router.canGoBack).mockReturnValue(true);
  const screen = await render(<DetailHeader title="拼單聊天室" />);
  await fireEvent.press(screen.getByRole('button', { name: '返回' }));
  expect(router.back).toHaveBeenCalledTimes(1);
  expect(router.replace).not.toHaveBeenCalled();
});
