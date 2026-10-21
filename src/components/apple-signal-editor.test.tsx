import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { AppState } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SignalEditor } from './core-stealth';
import { runAppleIntake } from '@/lib/apple-intake';
import { stealthApi } from '@/lib/stealth-api';
jest.mock('expo-router', () => ({ router: {} }));
jest.mock('@/lib/apple-intake', () => ({
  ...jest.requireActual<typeof import('@/lib/apple-intake')>('@/lib/apple-intake'),
  APPLE_INTAKE_ENABLED: true,
  appleIntakeAvailability: async () => 'available',
  runAppleIntake: jest.fn(),
  cancelAppleIntake: jest.fn(),
}));
jest.mock('@/lib/core-api', () => ({ coreError: () => '操作失敗', newRequestKey: () => 'key' }));
jest.mock('@/lib/core-hooks', () => ({ useCoreScreenFocused: () => true }));
jest.mock('@/lib/core-clock', () => ({ useCoreClock: () => ({}) }));
jest.mock('@/lib/stealth-api', () => {
  const actual = jest.requireActual<typeof import('@/lib/stealth-api')>('@/lib/stealth-api');
  return { ...actual, stealthApi: { create: jest.fn(), draft: jest.fn() } };
});
jest.mock('@/lib/api', () => ({ api: {} }));
jest.mock('@/store/auth-store', () => ({
  useAuthStore: Object.assign(() => undefined, { getState: () => ({ user: null }) }),
}));
jest.mock('@/lib/font-size-storage', () => ({
  fontSizeStorage: { getItem: jest.fn(() => null), setItem: jest.fn(), removeItem: jest.fn() },
}));
const client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: 0 } } });
beforeEach(() => {
  AppState.currentState = 'active';
  jest.mocked(AppState.addEventListener).mockReturnValue({ remove: jest.fn() });
});
afterEach(async () => {
  await act(async () => {
    client.clear();
  });
  jest.clearAllMocks();
});
it('applies an explicitly approved title while retaining manual money, time and roles without calling the backend', async () => {
  jest
    .mocked(runAppleIntake)
    .mockResolvedValue({
      summary: '想吃熱湯',
      questions: [],
      provider: 'apple_on_device',
      elapsedMs: 2000,
    });
  const screen = await render(
    <QueryClientProvider client={client}>
      <SignalEditor now={Date.now} refresh={async () => {}} localOnly />
    </QueryClientProvider>,
  );
  await act(async () => {
    await fireEvent.changeText(screen.getByLabelText('每人預算上限（整數，留白未知）'), '80');
    await fireEvent.changeText(screen.getByLabelText('已知每人費用（整數，留白未知）'), '60');
    await fireEvent.changeText(screen.getByLabelText('從服務時間幾分鐘後開始'), '45');
    await fireEvent.changeText(screen.getByLabelText('跟分身說需求或補充資訊'), '我想喝湯');
  });
  const roleStates = screen.getAllByRole('checkbox').map((item) => item.props.accessibilityState);
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '讓 Apple 分身整理' }));
  });
  await waitFor(() => expect(screen.getByText('想吃熱湯')).toBeTruthy());
  expect(screen.getByLabelText('我的需求或計畫（只有自己可見）').props.value).toBe('');
  await act(async () => {
    await fireEvent.changeText(screen.getByLabelText('核對後的需求標題'), '想喝熱湯，不方便取餐');
  });
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '將摘要放入需求標題，再手動核對' }));
  });
  expect(screen.getByLabelText('我的需求或計畫（只有自己可見）').props.value).toBe(
    '想喝熱湯，不方便取餐',
  );
  expect(screen.getByLabelText('每人預算上限（整數，留白未知）').props.value).toBe('80');
  expect(screen.getByLabelText('已知每人費用（整數，留白未知）').props.value).toBe('60');
  expect(screen.getByLabelText('從服務時間幾分鐘後開始').props.value).toBe('45');
  expect(screen.getAllByRole('checkbox').map((item) => item.props.accessibilityState)).toEqual(
    roleStates,
  );
  expect(screen.queryByRole('button', { name: '確認需求並交給分身' })).toBeNull();
  expect(stealthApi.create).not.toHaveBeenCalled();
  expect(stealthApi.draft).not.toHaveBeenCalled();
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '清除本機對話' }));
  });
  expect(screen.getByLabelText('我的需求或計畫（只有自己可見）').props.value).toBe(
    '想喝熱湯，不方便取餐',
  );
  expect(screen.getByLabelText('每人預算上限（整數，留白未知）').props.value).toBe('80');
  expect(screen.getByLabelText('已知每人費用（整數，留白未知）').props.value).toBe('60');
  expect(screen.getAllByRole('checkbox').map((item) => item.props.accessibilityState)).toEqual(
    roleStates,
  );
});

it('uses the existing connected save only after the user confirms the manually reviewed form', async () => {
  jest
    .mocked(runAppleIntake)
    .mockResolvedValue({
      summary: '熱湯',
      questions: [],
      provider: 'apple_on_device',
      elapsedMs: 1000,
    });
  jest
    .mocked(stealthApi.create)
    .mockResolvedValue({ matching: 'completed', new_matches: 0 } as never);
  const screen = await render(
    <QueryClientProvider client={client}>
      <SignalEditor now={() => Date.parse('2026-10-21T01:00:00Z')} refresh={async () => {}} />
    </QueryClientProvider>,
  );
  await act(async () => {
    await fireEvent.changeText(screen.getByLabelText('跟分身說需求或補充資訊'), '想喝熱湯，不取餐');
  });
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '讓 Apple 分身整理' }));
  });
  await act(async () => {
    await fireEvent.changeText(screen.getByLabelText('核對後的需求標題'), '熱湯，不方便取餐');
  });
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '將摘要放入需求標題，再手動核對' }));
  });
  expect(stealthApi.create).not.toHaveBeenCalled();
  await act(async () => {
    await fireEvent.changeText(screen.getByLabelText('每人預算上限（整數，留白未知）'), '80');
  });
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '確認需求並交給分身' }));
  });
  await waitFor(() => expect(stealthApi.create).toHaveBeenCalledTimes(1));
  expect(stealthApi.create).toHaveBeenCalledWith(
    expect.objectContaining({
      title: '熱湯，不方便取餐',
      budget_max_twd: 80,
      known_cost_twd: null,
      roles: [],
    }),
    'key',
  );
});
