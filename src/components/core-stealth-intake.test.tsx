import { afterEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StealthIntake } from './core-stealth-intake';
import { stealthApi, type StealthIntake as Intake } from '@/lib/stealth-api';

jest.mock('@/lib/stealth-api', () => {
  const actual = jest.requireActual<typeof import('@/lib/stealth-api')>('@/lib/stealth-api');
  return { ...actual, stealthApi: { intake: jest.fn() } };
});
jest.mock('@/lib/api', () => ({ api: {} }));
jest.mock('@/lib/core-api', () => ({ coreError: () => '模型未啟動' }));
jest.mock('@/lib/font-size-storage', () => ({
  fontSizeStorage: { getItem: jest.fn(() => null), setItem: jest.fn(), removeItem: jest.fn() },
}));
const client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: 0 } } });
const complete: Intake = {
  provider: 'ollama_local',
  is_llm: true,
  model: 'synthetic:1b',
  ready_for_review: true,
  questions: [],
  warnings: [],
  facts: {
    title: '一起吃披薩',
    kind: 'need',
    category: 'pizza',
    acceptable_categories: ['bakery'],
    location_id: 'main_gate',
    delay_minutes: 60,
    duration_minutes: 120,
    budget_max_twd: 120,
    budget_unknown: false,
    known_cost_twd: null,
    roles: ['share'],
    roles_confirmed: true,
    tags: [],
    dietary_requirements: ['素食'],
    evidence: { budget: '預算120', roles: '願意分食', cost: null, start: null, duration: null },
  },
};
afterEach(async () => {
  await act(async () => {
    client.clear();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  jest.clearAllMocks();
});

it('asks missing questions, carries user turns, and only applies after an explicit click', async () => {
  jest
    .mocked(stealthApi.intake)
    .mockResolvedValueOnce({
      ...complete,
      ready_for_review: false,
      questions: [{ field: 'location_id', text: '哪裡方便？' }],
    })
    .mockResolvedValueOnce(complete);
  const apply = jest.fn();
  const screen = await render(
    <QueryClientProvider client={client}>
      <StealthIntake onApply={apply} disabled={false} />
    </QueryClientProvider>,
  );
  await act(async () => {
    await fireEvent.changeText(screen.getByLabelText('跟分身說需求或補充資訊'), '想吃披薩');
  });
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '讓本機分身理解' }));
  });
  await waitFor(() => expect(screen.getByText('哪裡方便？')).toBeTruthy());
  expect(apply).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: '套用到下方表單，逐項檢查' })).toBeNull();
  await act(async () => {
    await fireEvent.changeText(
      screen.getByLabelText('跟分身說需求或補充資訊'),
      '正門，一小時後，持續兩小時，預算120，願意分食',
    );
  });
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '補充並重新整理' }));
  });
  await waitFor(() => expect(screen.getByText('資訊已足夠整理成待確認表單。')).toBeTruthy());
  expect(jest.mocked(stealthApi.intake).mock.calls[1][0]).toEqual([
    '想吃披薩',
    '正門，一小時後，持續兩小時，預算120，願意分食',
  ]);
  expect(jest.mocked(stealthApi.intake).mock.calls[1][1]).toEqual(complete.facts);
  expect(apply).not.toHaveBeenCalled();
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '查看理解依據（你的原句）' }));
  });
  expect(screen.getByText('預算依據：預算120')).toBeTruthy();
  expect(apply).not.toHaveBeenCalled();
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '套用到下方表單，逐項檢查' }));
  });
  expect(apply).toHaveBeenCalledWith(
    expect.objectContaining({
      cost: '',
      budget: '120',
      verified: '',
      requirements: '素食',
      roles: ['share'],
      alternatives: ['bakery'],
    }),
  );
  expect(screen.getByText(/已套用，尚未儲存/)).toBeTruthy();
});

it('keeps the original input and manual fallback when the model is offline', async () => {
  jest.mocked(stealthApi.intake).mockRejectedValue(new Error('offline'));
  const screen = await render(
    <QueryClientProvider client={client}>
      <StealthIntake onApply={jest.fn()} disabled={false} />
    </QueryClientProvider>,
  );
  await act(async () => {
    await fireEvent.changeText(screen.getByLabelText('跟分身說需求或補充資訊'), '晚餐');
  });
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '讓本機分身理解' }));
  });
  await waitFor(() => expect(screen.getByText(/模型未啟動/)).toBeTruthy());
  expect(screen.getByLabelText('跟分身說需求或補充資訊').props.value).toBe('晚餐');
});

it('keeps the last summary after a failed follow-up and blocks applying stale facts', async () => {
  jest.mocked(stealthApi.intake).mockResolvedValueOnce(complete).mockRejectedValueOnce(new Error('offline'));
  const apply = jest.fn();
  const screen = await render(<QueryClientProvider client={client}><StealthIntake onApply={apply} disabled={false} /></QueryClientProvider>);
  await act(async () => { await fireEvent.changeText(screen.getByLabelText('跟分身說需求或補充資訊'), '完整需求'); });
  await act(async () => { await fireEvent.press(screen.getByRole('button', { name: '讓本機分身理解' })); });
  await waitFor(() => expect(screen.getByText('資訊已足夠整理成待確認表單。')).toBeTruthy());
  await act(async () => { await fireEvent.changeText(screen.getByLabelText('跟分身說需求或補充資訊'), '預算改80'); });
  await act(async () => { await fireEvent.press(screen.getByRole('button', { name: '補充並重新整理' })); });
  await waitFor(() => expect(screen.getByText(/最新補充尚未成功/)).toBeTruthy());
  expect(screen.getByLabelText('跟分身說需求或補充資訊').props.value).toBe('預算改80');
  expect(screen.getByRole('button', { name: '套用到下方表單，逐項檢查' }).props.accessibilityState.disabled).toBe(true);
  expect(apply).not.toHaveBeenCalled();
});
