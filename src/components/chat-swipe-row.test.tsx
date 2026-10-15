import { it, expect, jest } from '@jest/globals';
import { createRef } from 'react';
import { View } from 'react-native';
import { act, render } from '@testing-library/react-native';
// Expo's resolver aliases these imports, but Jest exercises both platform implementations.
// eslint-disable-next-line import/no-duplicates
import { ChatSwipeRow } from './chat-swipe-row.web';
// eslint-disable-next-line import/no-duplicates
import { ChatSwipeRow as NativeChatSwipeRow } from './chat-swipe-row';
import type { ChatSwipeHandle } from './chat-swipe-row.types';

it.each([ChatSwipeRow, NativeChatSwipeRow])('keeps the row handle stable across rerenders and uses the latest close callback (%#)', async (Row) => {
  const ref = createRef<ChatSwipeHandle>();
  const firstClose = jest.fn();
  const latestClose = jest.fn();
  const props = { onOpenStart: jest.fn(), onOpen: jest.fn(), leftActions: <View />, rightActions: <View /> };
  const screen = await render(<Row {...props} ref={ref} onClose={firstClose}><View /></Row>);
  const handle = ref.current;
  await screen.rerender(<Row {...props} ref={ref} onClose={latestClose}><View /></Row>);
  expect(ref.current).toBe(handle);
  await act(() => { handle?.close(); });
  expect(latestClose).toHaveBeenCalledTimes(1);
  expect(firstClose).not.toHaveBeenCalled();
});

it.each(['release', 'cancel', 'close', 'unmount'])('unlocks list scrolling after a horizontal gesture ends via %s', async (ending) => {
  const ref = createRef<ChatSwipeHandle>();
  const lock = jest.fn();
  const screen = await render(
    <ChatSwipeRow ref={ref} leftActions={<View />} rightActions={<View />} onOpenStart={jest.fn()} onOpen={jest.fn()} onClose={jest.fn()} onGestureActiveChange={lock}><View /></ChatSwipeRow>,
  );
  const root = screen.root!;
  const event = { pointerId: 1, button: 0, pageX: 100, pageY: 100, target: { closest: () => true }, currentTarget: { setPointerCapture: jest.fn() }, preventDefault: jest.fn() };
  await act(() => {
    root.props.onPointerDown(event);
    root.props.onPointerMove({ ...event, pageX: 102, pageY: 130 });
  });
  expect(lock).not.toHaveBeenCalled();
  await act(() => { root.props.onPointerMove({ ...event, pageX: 120, pageY: 102 }); });
  expect(lock.mock.calls).toEqual([[true]]);
  if (ending === 'unmount') await screen.unmount();
  else await act(() => {
    if (ending === 'release') root.props.onPointerUp({ ...event, pageX: 120 });
    if (ending === 'cancel') root.props.onPointerCancel();
    if (ending === 'close') ref.current?.close();
  });
  expect(lock.mock.calls).toEqual([[true], [false]]);
});
