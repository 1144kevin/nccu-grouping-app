import { expect, it, jest } from '@jest/globals';
import { act, render } from '@testing-library/react-native';
import { PullRefreshControl } from './pull-refresh-control';
jest.mock('react-native/Libraries/Components/RefreshControl/RefreshControl', () => ({
  __esModule: true,
  default: 'RefreshControl',
}));

it('starts the spinner only for a pull and keeps it until that request settles', async () => {
  let finish!: () => void;
  const refresh = jest.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const screen = await render(<PullRefreshControl testID="pull" onRefresh={refresh} />);
  expect(screen.getByTestId('pull').props.refreshing).toBe(false);
  // A background parent render/poll must not show the pull spinner.
  await screen.rerender(<PullRefreshControl testID="pull" onRefresh={refresh} />);
  expect(screen.getByTestId('pull').props.refreshing).toBe(false);
  await act(async () => {
    screen.getByTestId('pull').props.onRefresh();
  });
  expect(screen.getByTestId('pull').props.refreshing).toBe(true);
  await act(async () => {
    screen.getByTestId('pull').props.onRefresh();
  });
  expect(refresh).toHaveBeenCalledTimes(1);
  await act(async () => {
    finish();
  });
  expect(screen.getByTestId('pull').props.refreshing).toBe(false);
});
