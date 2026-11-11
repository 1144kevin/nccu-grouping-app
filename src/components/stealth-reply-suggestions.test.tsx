import { expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import { COMMON_REPLIES, StealthReplySuggestions } from './stealth-reply-suggestions';
import { stealthApi } from '@/lib/stealth-api';

jest.mock('@/lib/stealth-api', () => ({
  stealthApi: { replySuggestions: jest.fn(), roomSend: jest.fn() },
}));
jest.mock('@/lib/font-size-storage', () => ({
  fontSizeStorage: { getItem: () => null, setItem: jest.fn(), removeItem: jest.fn() },
}));

it('shows three distinct fixed suggestions and changes to a different batch without calling AI', async () => {
  const choose = jest.fn();
  const screen = await render(
    <StealthReplySuggestions
      id="room"
      actor="me"
      contextKey="initial"
      enabled
      disabled={false}
      onSelect={choose}
    />,
  );
  const first = screen
    .getAllByRole('button')
    .filter((item) => String(item.props.accessibilityLabel ?? '').startsWith('使用建議'));
  expect(first).toHaveLength(3);
  const labels = first.map((item) => String(item.props.accessibilityLabel));
  await fireEvent.press(first[0]);
  expect(COMMON_REPLIES).toContain(choose.mock.calls[0][0]);
  await fireEvent.press(screen.getByRole('button', { name: '換一批回覆建議' }));
  const next = screen
    .getAllByRole('button')
    .filter((item) => String(item.props.accessibilityLabel ?? '').startsWith('使用建議'));
  expect(next).toHaveLength(3);
  expect(
    next.every(
      (item) =>
        !labels.some(
          (label) =>
            label.slice(label.indexOf('：')) ===
            String(item.props.accessibilityLabel).slice(
              String(item.props.accessibilityLabel).indexOf('：'),
            ),
        ),
    ),
  ).toBe(true);
  expect(stealthApi.replySuggestions).not.toHaveBeenCalled();
});
