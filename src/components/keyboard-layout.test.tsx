import { afterEach, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import { Platform, TextInput, type KeyboardAvoidingViewProps } from 'react-native';
import { KeyboardScrollView, KeyboardViewport } from './keyboard-layout';

let mockWindowTop = 120;
const mockAvoidance = jest.fn<(props: KeyboardAvoidingViewProps) => void>();
jest.mock('react-native', () => {
  const actual = jest.requireActual<typeof import('react-native')>('react-native');
  const React = jest.requireActual<typeof import('react')>('react');
  function MeasuredView({ ref, ...props }: import('react-native').ViewProps & { ref?: import('react').Ref<unknown> }) {
    React.useImperativeHandle(ref, () => ({ measureInWindow: (cb: (x: number, y: number) => void) => cb(0, mockWindowTop) }));
    return React.createElement(actual.View, props);
  }
  function Avoidance(props: KeyboardAvoidingViewProps) {
    mockAvoidance(props);
    return React.createElement(actual.KeyboardAvoidingView, props);
  }
  return Object.create(actual, { View: { value: MeasuredView }, KeyboardAvoidingView: { value: Avoidance } });
});
const original = Platform.OS;
afterEach(() => { Platform.OS = original; mockWindowTop = 120; jest.clearAllMocks(); });

it('lets iOS own form insets without adding a second keyboard avoidance layer', async () => {
  Platform.OS = 'ios';
  const screen = await render(<KeyboardScrollView testID="scroll"><TextInput accessibilityLabel="需求" defaultValue="保留需求" /></KeyboardScrollView>);
  expect(screen.getByTestId('scroll').props.automaticallyAdjustKeyboardInsets).toBe(true);
  expect(mockAvoidance).not.toHaveBeenCalled();
  expect(screen.getByLabelText('需求').props.defaultValue).toBe('保留需求');
});

it('measures the fixed composer offset below the banner and remeasures layout changes', async () => {
  Platform.OS = 'ios';
  const screen = await render(<KeyboardViewport><TextInput accessibilityLabel="訊息" defaultValue="草稿" /></KeyboardViewport>);
  await fireEvent(screen.getByTestId('keyboard-viewport'), 'layout', {});
  expect(mockAvoidance.mock.lastCall?.[0].keyboardVerticalOffset).toBe(120);
  mockWindowTop = 80;
  await fireEvent(screen.getByTestId('keyboard-viewport'), 'layout', {});
  expect(mockAvoidance.mock.lastCall?.[0].keyboardVerticalOffset).toBe(80);
  mockWindowTop = Number.NaN;
  await fireEvent(screen.getByTestId('keyboard-viewport'), 'layout', {});
  expect(mockAvoidance.mock.lastCall?.[0].keyboardVerticalOffset).toBe(80);
  expect(screen.getByLabelText('訊息').props.defaultValue).toBe('草稿');
});

it('leaves Web viewport sizing to the browser', async () => {
  Platform.OS = 'web';
  const scroll = await render(<KeyboardScrollView testID="scroll" />);
  expect(scroll.getByTestId('scroll').props.automaticallyAdjustKeyboardInsets).toBe(false);
  await scroll.unmount();
  await render(<KeyboardViewport />);
  expect(mockAvoidance.mock.lastCall?.[0].enabled).toBe(false);
});
