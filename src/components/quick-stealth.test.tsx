import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { router } from 'expo-router';
import { AppState } from 'react-native';
import { QuickStealthScreen, QuickMatch } from './quick-stealth';
import { StealthCoordinationChat } from './stealth-coordination-chat';
import { queryClient } from '@/lib/query-client';
import { stealthApi, type StealthMatch } from '@/lib/stealth-api';

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual<typeof import('react-native-safe-area-context')>(
    'react-native-safe-area-context',
  ),
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/lib/api', () => ({ api: {} }));
jest.mock('@/lib/post-speech', () => ({ startPostSpeech: jest.fn() }));
let mockKey = 0;
jest.mock('@/lib/core-api', () => ({
  coreError: () => '連線失敗',
  newRequestKey: () => `request-key-${++mockKey}`,
}));
jest.mock('@/lib/core-hooks', () => ({ useCoreScreenFocused: () => true }));
jest.mock('@/lib/query-client', () => {
  const { QueryClient } =
    jest.requireActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    queryClient: new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false, gcTime: 0 },
      },
    }),
  };
});
jest.mock('@/lib/core-clock', () => ({
  useCoreClock: () => ({ data: { driftMs: 0 }, now: () => Date.parse('2026-10-22T10:00:00Z') }),
}));
jest.mock('@/lib/stealth-api', () => ({
  stealthApi: {
    quickStatus: jest.fn(),
    agent: jest.fn(),
    signals: jest.fn(),
    matches: jest.fn(),
    quickStart: jest.fn(),
    quickInterview: jest.fn(),
    conversation: jest.fn(),
    discover: jest.fn(),
    semantic: jest.fn(),
    decide: jest.fn(),
    consent: jest.fn(),
    terms: jest.fn(),
    room: jest.fn(),
    roomSend: jest.fn(),
    revoke: jest.fn(),
  },
}));
jest.mock('@/store/auth-store', () => ({
  useAuthStore: Object.assign(
    (select: (state: { user: { id: string } }) => unknown) => select({ user: { id: 'self' } }),
    { getState: () => ({ user: { id: 'self' } }) },
  ),
}));
jest.mock('@/lib/font-size-storage', () => ({
  fontSizeStorage: { getItem: jest.fn(() => null), setItem: jest.fn(), removeItem: jest.fn() },
}));

const result = {
  created: { signal: { title: '我今天想喝50嵐' }, matching: 'completed' },
  sources: ['首次暫用正門'],
  interpretation: 'local_model',
};
const match = {
  id: 'pair',
  category: 'drink',
  member_count: 2,
  my_member_number: 1,
  reasons: ['時間相近'],
  unknowns: [],
  status: 'pending',
  my_decision: 'pending',
  is_demo: false,
  known_cost_twd: null,
} as unknown as StealthMatch;
beforeEach(() => {
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  jest.mocked(stealthApi.quickStatus).mockResolvedValue({ ready: true });
  jest.mocked(stealthApi.agent).mockResolvedValue(null);
  jest.mocked(stealthApi.signals).mockResolvedValue({ items: [] });
  jest.mocked(stealthApi.matches).mockResolvedValue({ items: [] });
  jest.mocked(stealthApi.quickStart).mockResolvedValue(result as never);
  jest.mocked(stealthApi.discover).mockResolvedValue({ created: 0, indexed: 1 });
  jest.mocked(stealthApi.semantic).mockResolvedValue({
    items: [],
    ranking: { status: 'empty', items: [], warnings: [] },
  } as never);
});
afterEach(async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    queryClient.clear();
  });
  jest.resetAllMocks();
  jest.restoreAllMocks();
});
const wrap = (children: React.ReactNode) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

it('shows multiple independent requests in a horizontal carousel until their own expiry', async () => {
  jest.mocked(stealthApi.signals).mockResolvedValue({
    items: [
      {
        id: 'one',
        title: '需求一',
        category: 'drink',
        location_id: 'main_gate',
        status: 'active',
        roles: [],
        budget_max_twd: 200,
        starts_at: '2026-10-22T08:00:00Z',
        ends_at: '2026-10-22T09:00:00Z',
        expires_at: '2026-10-23T08:00:00Z',
        created_at: '2026-10-22T08:00:00Z',
      },
      {
        id: 'two',
        title: '需求二',
        category: 'meal',
        location_id: '自強10舍',
        status: 'active',
        roles: [],
        budget_max_twd: 100,
        starts_at: '2026-10-22T10:00:00Z',
        ends_at: '2026-10-22T12:00:00Z',
        expires_at: '2026-10-23T10:00:00Z',
        created_at: '2026-10-22T10:00:00Z',
      },
    ],
  } as never);
  const screen = await render(wrap(<QuickStealthScreen />));
  await waitFor(() => expect(screen.getByText('需求二')).toBeTruthy());
  expect(screen.getByText('需求一')).toBeTruthy();
  expect(screen.getByLabelText('我的需求卡片，可左右滑動')).toHaveProp('horizontal', true);
  expect(screen.getAllByRole('button', { name: /^停止需求：/ })).toHaveLength(2);
  expect(screen.queryByText('停止這個需求')).toBeNull();
  expect(screen.queryByText('這次幫你找')).toBeNull();
});

it('opens with a greeting without inference or automatic matching', async () => {
  const screen = await render(wrap(<QuickStealthScreen />));
  expect(screen.getByText(/今天有什麼想跟我分享/)).toBeTruthy();
  expect(screen.getByLabelText('跟偷揪分身聊天')).toBeTruthy();
  expect(stealthApi.conversation).not.toHaveBeenCalled();
  expect(stealthApi.quickStart).not.toHaveBeenCalled();
  expect(stealthApi.consent).not.toHaveBeenCalled();
});

it('opens preferences without exposing the legacy advanced controls', async () => {
  jest.mocked(stealthApi.quickStatus).mockResolvedValue({ ready: false });
  const screen = await render(wrap(<QuickStealthScreen />));
  await waitFor(() => expect(screen.getByText(/目前無法自動找人/)).toBeTruthy());
  expect(screen.getByRole('button', { name: '想喝飲料' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: '分身偏好' }));
  expect(router.push).toHaveBeenCalledWith('/stealth-preferences');
  expect(screen.queryByText('每日邀請上限')).toBeNull();
  expect(stealthApi.quickStart).not.toHaveBeenCalled();
});

it('preliminary acceptance opens coordination only after everyone accepts and never consents to final terms', async () => {
  jest.mocked(stealthApi.decide).mockResolvedValue({ ...match, status: 'ready' });
  const screen = await render(
    wrap(<QuickMatch match={match} explanation={[]} refresh={async () => undefined} />),
  );
  await fireEvent.press(screen.getByRole('button', { name: '有興趣，先聊聊' }));
  await waitFor(() =>
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/stealth-chat/[id]',
      params: { id: 'pair' },
    }),
  );
  expect(stealthApi.decide).toHaveBeenCalledWith('pair', 'accepted');
  expect(stealthApi.consent).not.toHaveBeenCalled();
  expect(stealthApi.terms).not.toHaveBeenCalled();
});

it('coordination waits for all members and retrying a message preserves its key', async () => {
  jest.mocked(stealthApi.room).mockResolvedValue({ opened: false, can_send: false, items: [] });
  const screen = await render(wrap(<StealthCoordinationChat id="pair" />));
  await waitFor(() => expect(screen.getByText(/還在等待其他夥伴同意/)).toBeTruthy());
  expect(screen.getByRole('button', { name: '傳送' })).toBeDisabled();
  jest.mocked(stealthApi.room).mockResolvedValue({ opened: true, can_send: true, items: [] });
  await act(async () => {
    await queryClient.invalidateQueries({ queryKey: ['core', 'self', 'stealth'] });
  });
  await waitFor(() => expect(screen.getByLabelText('偷揪聊天室訊息')).toHaveProp('editable', true));
  await fireEvent.changeText(screen.getByLabelText('偷揪聊天室訊息'), '我可以去拿');
  jest
    .mocked(stealthApi.roomSend)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ id: 'message' } as never);
  await fireEvent.press(screen.getByRole('button', { name: '傳送' }));
  await waitFor(() => expect(screen.getByText(/文字已保留/)).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: '傳送' }));
  await waitFor(() => expect(stealthApi.roomSend).toHaveBeenCalledTimes(2));
  expect(jest.mocked(stealthApi.roomSend).mock.calls[1]).toEqual(
    jest.mocked(stealthApi.roomSend).mock.calls[0],
  );
});

it('keeps opened withdrawn rooms accessible as read-only history', async () => {
  const screen = await render(
    wrap(
      <QuickMatch
        match={{ ...match, status: 'unavailable', coordination_opened: true }}
        explanation={[]}
        refresh={async () => undefined}
      />,
    ),
  );
  expect(screen.getByRole('button', { name: '查看聊天室紀錄' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: '有興趣，先聊聊' })).toBeNull();
  expect(screen.queryByRole('button', { name: '這次先不用' })).toBeNull();
});

it('keeps accepted invitations visible while waiting and hides expired opportunities', async () => {
  const active = {
    ...match,
    starts_at: '2026-10-22T10:00:00Z',
    expires_at: '2026-10-22T12:00:00Z',
    score: 70,
    location_id: 'main_gate',
  };
  jest.mocked(stealthApi.matches).mockResolvedValue({
    items: [
      active,
      { ...active, id: 'accepted', my_decision: 'accepted' },
      { ...active, id: 'formed', status: 'formed' },
      { ...active, id: 'expired', expires_at: '2026-10-21T12:00:00Z' },
    ],
  } as never);
  const screen = await render(wrap(<QuickStealthScreen />));
  await waitFor(() =>
    expect(screen.getAllByRole('button', { name: '有興趣，先聊聊' })).toHaveLength(1),
  );
  expect(screen.getByText(/你已表示有興趣/)).toBeTruthy();
});

it('allows text and photo picking in an opened chat even when its invitation has expired', async () => {
  jest.mocked(stealthApi.matches).mockResolvedValue({
    items: [{ ...match, status: 'unavailable', coordination_opened: true }],
  } as never);
  jest.mocked(stealthApi.room).mockResolvedValue({ opened: true, can_send: true, items: [] });
  let resolve!: (v: never) => void;
  jest.mocked(stealthApi.roomSend).mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const screen = await render(wrap(<StealthCoordinationChat id="pair" />));
  await waitFor(() => expect(screen.getByLabelText('偷揪聊天室訊息')).toHaveProp('editable', true));
  expect(screen.getByRole('button', { name: '傳送照片' })).toBeEnabled();
  await fireEvent.changeText(screen.getByLabelText('偷揪聊天室訊息'), '我可以先去拿便當');
  await fireEvent.press(screen.getByRole('button', { name: '傳送' }));
  await waitFor(() => expect(screen.getByText('我可以先去拿便當')).toBeTruthy());
  await act(async () => resolve({ id: 'stealth-confirmed' } as never));
  await waitFor(() => expect(screen.getByLabelText('偷揪聊天室訊息')).toHaveProp('value', ''));
  expect(screen.getAllByText('我可以先去拿便當')).toHaveLength(1);
});

it('keeps a newly accepted card through a stale refresh and updates it when partners accept', async () => {
  const live = {
    ...match,
    starts_at: '2026-10-22T10:00:00Z',
    expires_at: '2026-10-22T12:00:00Z',
    score: 70,
    location_id: 'main_gate',
  } as StealthMatch;
  jest.mocked(stealthApi.matches).mockResolvedValue({ items: [live] });
  jest.mocked(stealthApi.decide).mockResolvedValue({ ...live, my_decision: 'accepted' });
  const screen = await render(wrap(<QuickStealthScreen />));
  await waitFor(() => expect(screen.getByRole('button', { name: '有興趣，先聊聊' })).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: '有興趣，先聊聊' }));
  await waitFor(() => expect(screen.getByText(/你已表示有興趣/)).toBeTruthy());
  expect(router.push).not.toHaveBeenCalled();
  jest
    .mocked(stealthApi.matches)
    .mockResolvedValue({ items: [{ ...live, my_decision: 'accepted', status: 'ready' }] });
  await act(async () => {
    await queryClient.invalidateQueries({ queryKey: ['core', 'self', 'stealth'] });
  });
  await waitFor(() => expect(screen.getByRole('button', { name: '開始聊天' })).toBeTruthy());
});

it('removes a withdrawn card even if the next refresh still has the old accepted decision', async () => {
  const live = {
    ...match,
    my_decision: 'accepted',
    starts_at: '2026-10-22T10:00:00Z',
    expires_at: '2026-10-22T12:00:00Z',
    score: 70,
    location_id: 'main_gate',
  } as StealthMatch;
  jest.mocked(stealthApi.matches).mockResolvedValue({ items: [live] });
  jest.mocked(stealthApi.decide).mockResolvedValue({ ...live, my_decision: 'declined' });
  const screen = await render(wrap(<QuickStealthScreen />));
  await waitFor(() => expect(screen.getByRole('button', { name: '撤回聊聊邀請' })).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: '撤回聊聊邀請' }));
  await waitFor(() => expect(screen.queryByText(/你已表示有興趣/)).toBeNull());
});
