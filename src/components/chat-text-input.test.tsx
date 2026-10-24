import { expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ChatTextInput } from './chat-text-input';
jest.mock('@/lib/font-size-storage', () => ({
  fontSizeStorage: { getItem: () => null, setItem: jest.fn(), removeItem: jest.fn() },
}));
it('starts at one line, grows for multiline text, shrinks after deletion, and resets after send', async () => {
  const screen = await render(<ChatTextInput accessibilityLabel="訊息" value="" />);
  const height = () => StyleSheet.flatten(screen.getByLabelText('訊息').props.style).height;
  expect(height()).toBe(40);
  await screen.rerender(
    <ChatTextInput accessibilityLabel="訊息" value={'第一行\n第二行\n第三行'} />,
  );
  await fireEvent(screen.getByLabelText('訊息'), 'contentSizeChange', {
    nativeEvent: { contentSize: { width: 100, height: 72 } },
  });
  expect(height()).toBe(86);
  await fireEvent(screen.getByLabelText('訊息'), 'contentSizeChange', {
    nativeEvent: { contentSize: { width: 100, height: 200 } },
  });
  expect(height()).toBe(120);
  await screen.rerender(<ChatTextInput accessibilityLabel="訊息" value="一行" />);
  await fireEvent(screen.getByLabelText('訊息'), 'contentSizeChange', {
    nativeEvent: { contentSize: { width: 100, height: 24 } },
  });
  expect(height()).toBe(40);
  await screen.rerender(<ChatTextInput accessibilityLabel="訊息" value="" />);
  expect(height()).toBe(40);
});
