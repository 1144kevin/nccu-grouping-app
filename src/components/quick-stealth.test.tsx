import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { router } from 'expo-router';
import { QuickStealthScreen, QuickMatch } from './quick-stealth';
import { StealthCoordinationChat } from './stealth-coordination-chat';
import { queryClient } from '@/lib/query-client';
import { stealthApi, type StealthMatch } from '@/lib/stealth-api';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/lib/api', () => ({ api: {} }));
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
});
const wrap = (children: React.ReactNode) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

it('offers one sentence and one start action, automatically orchestrating search without final consent', async () => {
  const screen = await render(wrap(<QuickStealthScreen onAdvanced={jest.fn()} />));
  expect(screen.getAllByLabelText('一句話告訴分身')).toHaveLength(1);
  expect(screen.queryByRole('button', { name: 'AI 搜尋新配對機會' })).toBeNull();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '啟用分身並幫我揪' })).toBeTruthy(),
  );
  await fireEvent.changeText(screen.getByLabelText('一句話告訴分身'), '我今天想喝50嵐');
  await fireEvent.press(screen.getByRole('button', { name: '啟用分身並幫我揪' }));
  await waitFor(() => expect(stealthApi.semantic).toHaveBeenCalledTimes(1));
  expect(stealthApi.quickStart).toHaveBeenCalledWith('我今天想喝50嵐', true, expect.any(String));
  expect(stealthApi.discover).toHaveBeenCalledTimes(1);
  expect(stealthApi.consent).not.toHaveBeenCalled();
  expect(stealthApi.terms).not.toHaveBeenCalled();
});

it('keeps the original settings usable when the development database migration is pending', async () => {
  jest.mocked(stealthApi.quickStatus).mockResolvedValue({ ready: false });
  const advanced = jest.fn();
  const screen = await render(wrap(<QuickStealthScreen onAdvanced={advanced} />));
  await fireEvent.changeText(screen.getByLabelText('一句話告訴分身'), '我今天想喝50嵐');
  await waitFor(() => expect(screen.getByText(/尚未接通開發資料庫/)).toBeTruthy());
  expect(screen.getByRole('button', { name: '啟用分身並幫我揪' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: '分身與需求進階設定' }));
  expect(advanced).toHaveBeenCalledTimes(1);
  expect(stealthApi.quickStart).not.toHaveBeenCalled();
});

it('preserves the sentence and request key after an uncertain network failure', async () => {
  jest
    .mocked(stealthApi.quickStart)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(result as never);
  const screen = await render(wrap(<QuickStealthScreen onAdvanced={jest.fn()} />));
  await fireEvent.changeText(screen.getByLabelText('一句話告訴分身'), '我今天想喝50嵐');
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '啟用分身並幫我揪' })).toBeEnabled(),
  );
  await fireEvent.press(screen.getByRole('button', { name: '啟用分身並幫我揪' }));
  await waitFor(() => expect(screen.getByText(/輸入已保留/)).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: '啟用分身並幫我揪' }));
  await waitFor(() => expect(stealthApi.quickStart).toHaveBeenCalledTimes(2));
  expect(jest.mocked(stealthApi.quickStart).mock.calls[1]).toEqual(
    jest.mocked(stealthApi.quickStart).mock.calls[0],
  );
});

it('keeps a committed request when semantic inference fails', async () => {
  jest.mocked(stealthApi.discover).mockRejectedValueOnce(new Error('model busy'));
  const screen = await render(wrap(<QuickStealthScreen onAdvanced={jest.fn()} />));
  await fireEvent.changeText(screen.getByLabelText('一句話告訴分身'), '我今天想喝50嵐');
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '啟用分身並幫我揪' })).toBeEnabled(),
  );
  await fireEvent.press(screen.getByRole('button', { name: '啟用分身並幫我揪' }));
  await waitFor(() => expect(screen.getByText(/需求已儲存。AI 搜尋暫未完成/)).toBeTruthy());
  expect(screen.getByText(/已記住：我今天想喝50嵐/)).toBeTruthy();
  expect(stealthApi.quickStart).toHaveBeenCalledTimes(1);
});

it('preliminary acceptance opens coordination only after everyone accepts and never consents to final terms', async () => {
  jest.mocked(stealthApi.decide).mockResolvedValue({ ...match, status: 'ready' });
  const screen = await render(
    wrap(<QuickMatch match={match} explanation={[]} refresh={async () => undefined} />),
  );
  await fireEvent.press(screen.getByRole('button', { name: '同意初步安排，進聊天室' }));
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
  expect(screen.queryByRole('button', { name: '同意初步安排，進聊天室' })).toBeNull();
  expect(screen.queryByRole('button', { name: '這次先不用' })).toBeNull();
});
