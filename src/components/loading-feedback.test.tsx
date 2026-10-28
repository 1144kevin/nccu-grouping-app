import { expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import { InlineLoading } from './inline-loading';
import { EmptyState, PrimaryButton } from './primitives';
import { colors } from '@/theme/tokens';

jest.mock('expo-router', () => ({ Link: 'Link', router: {} }));

it('replaces the empty state with a grey spinner while loading', async () => {
  const screen = await render(<EmptyState icon="magnify" title="搜尋中" loading />);
  expect(screen.getByRole('progressbar', { name: '搜尋中' }).props.color).toBe(colors.muted);
  expect(screen.queryByText('搜尋中')).toBeNull();
  await screen.rerender(<EmptyState icon="magnify" title="沒有符合的拼單" />);
  expect(screen.queryByRole('progressbar')).toBeNull();
  expect(screen.getByText('沒有符合的拼單')).toBeTruthy();
});

it('shows progress and prevents duplicate button presses until the operation finishes', async () => {
  const press = jest.fn();
  const screen = await render(
    <PrimaryButton loading onPress={press}>
      儲存
    </PrimaryButton>,
  );
  expect(screen.getByRole('progressbar')).toBeTruthy();
  expect(screen.getByRole('button', { name: '儲存' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: '儲存' }));
  expect(press).not.toHaveBeenCalled();
  await screen.rerender(<PrimaryButton onPress={press}>儲存</PrimaryButton>);
  expect(screen.queryByRole('progressbar')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: '儲存' }));
  expect(press).toHaveBeenCalledTimes(1);
});

it('shows an accessible compact spinner for an outgoing message', async () => {
  const screen = await render(<InlineLoading label="傳送中" />);
  expect(screen.getByRole('progressbar', { name: '傳送中' }).props.animating).not.toBe(false);
  expect(screen.queryByText('傳送中…')).toBeNull();
});
