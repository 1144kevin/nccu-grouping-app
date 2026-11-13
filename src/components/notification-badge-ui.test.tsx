import { expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';
import { AppHeader } from './primitives';
import { AppDrawer } from './app-drawer';

let mockCount = 3;
jest.mock('@/lib/notification-badge', () => ({
  useNotificationBadge: () => ({ count: mockCount }),
  useStealthBadge: () => ({ count: 0 }),
}));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual<typeof import('react-native-safe-area-context')>('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('expo-router', () => ({ Link: ({ children }: { children: React.ReactNode }) => children, router: { push: jest.fn() } }));
jest.mock('@/store/navigation-store', () => ({ useNavigationStore: (select: (s: object) => unknown) => select({ drawerOpen: true, closeDrawer: jest.fn(), openDrawer: jest.fn() }) }));
jest.mock('@/store/auth-store', () => ({ useAuthStore: (select?: (s: object) => unknown) => select ? select({ user: { id: 'actor', display_name: '測試' } }) : ({ logout: jest.fn(), busy: false }) }));
jest.mock('@/store/app-store', () => ({ useAppStore: (select: (s: object) => unknown) => select({ currentUser: { name: '測試', badge: '🍱' } }) }));
jest.mock('@/components/brand-logo', () => ({ BrandLogo: () => null }));
jest.mock('@/components/pizza-shower', () => ({ usePizzaLogoPress: () => jest.fn() }));
jest.mock('@/components/primitives', () => {
  const actual = jest.requireActual<typeof import('./primitives')>('./primitives');
  return { ...actual, Avatar: () => null };
});

it('shows the same unread count on the menu and drawer notification entry', async () => {
  const header = await render(<AppHeader title="首頁" />);
  expect(header.getByLabelText('開啟選單，3 則未讀通知')).toBeTruthy();
  const drawer = await render(<AppDrawer />);
  expect(drawer.getByLabelText('3 則未讀通知')).toBeTruthy();
  expect(drawer.getByText('3')).toBeTruthy();
});

it('hides the notification badge when nothing is unread', async () => {
  mockCount = 0;
  const header = await render(<AppHeader title="首頁" />);
  expect(header.getByLabelText('開啟選單')).toBeTruthy();
  const drawer = await render(<AppDrawer />);
  expect(drawer.queryByLabelText(/則未讀通知/)).toBeNull();
});
