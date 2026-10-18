import { afterEach, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { useCoreScreenFocused } from './core-hooks';

jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => () => void) => {
    jest.requireActual<typeof import('react')>('react').useEffect(callback, [callback]);
  },
}));
jest.mock('@/lib/core-api', () => ({ CORE_API_ENABLED: true, coreApi: {}, toFeedPost: jest.fn() }));
jest.mock('@/lib/query-client', () => ({ queryClient: {} }));
jest.mock('@/store/auth-store', () => ({ useAuthStore: jest.fn() }));
jest.mock('@/store/app-store', () => ({ useAppStore: {} }));

afterEach(() => {
  jest.restoreAllMocks();
});

it('background and inactive screens cannot keep polling or mark incoming messages read', async () => {
  let onState: ((state: AppStateStatus) => void) | undefined;
  const remove = jest.fn();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_, callback) => {
    onState = callback;
    return { remove };
  });
  const screen = await renderHook(() => useCoreScreenFocused());
  await act(async () => onState?.('active'));
  expect(screen.result.current).toBe(true);
  await act(async () => onState?.('background'));
  expect(screen.result.current).toBe(false);
  await act(async () => onState?.('inactive'));
  expect(screen.result.current).toBe(false);
  await act(async () => onState?.('active'));
  expect(screen.result.current).toBe(true);
  await screen.unmount();
  expect(remove).toHaveBeenCalledTimes(1);
});
