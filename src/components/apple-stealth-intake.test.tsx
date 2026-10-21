import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { AppleStealthIntake } from './apple-stealth-intake';
import { appleIntakeAvailability, cancelAppleIntake, runAppleIntake } from '@/lib/apple-intake';

jest.mock('@/lib/apple-intake', () => ({
  ...jest.requireActual<typeof import('@/lib/apple-intake')>('@/lib/apple-intake'),
  appleIntakeAvailability: jest.fn(),
  runAppleIntake: jest.fn(),
  cancelAppleIntake: jest.fn(),
}));
jest.mock('@/lib/font-size-storage', () => ({
  fontSizeStorage: { getItem: jest.fn(() => null), setItem: jest.fn(), removeItem: jest.fn() },
}));
const result = {
  summary: '想吃熱湯，預算待確認',
  questions: ['在哪裡取餐？'],
  provider: 'apple_on_device' as const,
  elapsedMs: 3000,
};
beforeEach(() => {
  AppState.currentState = 'active';
  jest.mocked(AppState.addEventListener).mockReturnValue({ remove: jest.fn() });
  jest.mocked(appleIntakeAvailability).mockResolvedValue('available');
});
afterEach(() => {
  jest.resetAllMocks();
});

async function send(
  screen: Awaited<ReturnType<typeof render>>,
  text: string,
  button = '讓 Apple 分身整理',
) {
  await act(async () => {
    await fireEvent.changeText(screen.getByLabelText('跟分身說需求或補充資訊'), text);
  });
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: button }));
  });
}

it('carries corrections and requires a separate click to apply only a summary', async () => {
  jest
    .mocked(runAppleIntake)
    .mockResolvedValueOnce(result)
    .mockResolvedValueOnce({ ...result, summary: '改吃披薩，預算80元' });
  const apply = jest.fn();
  const screen = await render(<AppleStealthIntake disabled={false} onApplySummary={apply} />);
  await waitFor(() => expect(appleIntakeAvailability).toHaveBeenCalled());
  await act(async () => {
    await fireEvent.changeText(screen.getByLabelText('跟分身說需求或補充資訊'), '想吃熱湯');
  });
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '讓 Apple 分身整理' }));
  });
  await waitFor(() => expect(screen.getByText(result.summary)).toBeTruthy());
  expect(apply).not.toHaveBeenCalled();
  await act(async () => {
    await fireEvent.changeText(screen.getByLabelText('跟分身說需求或補充資訊'), '改吃披薩，預算80');
  });
  expect(
    screen.getByRole('button', { name: '將摘要放入需求標題，再手動核對' }).props.accessibilityState
      .disabled,
  ).toBe(true);
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '補充並重新整理' }));
  });
  expect(jest.mocked(runAppleIntake).mock.calls[1][1]).toEqual(['想吃熱湯', '改吃披薩，預算80']);
  expect(apply).not.toHaveBeenCalled();
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '將摘要放入需求標題，再手動核對' }));
  });
  expect(apply).toHaveBeenCalledWith('改吃披薩，預算80元');
});

it('retains failed follow-up input and refuses to apply the previous summary', async () => {
  jest
    .mocked(runAppleIntake)
    .mockResolvedValueOnce(result)
    .mockRejectedValueOnce(new Error('failed'));
  const apply = jest.fn();
  const screen = await render(<AppleStealthIntake disabled={false} onApplySummary={apply} />);
  await act(async () => {
    await fireEvent.changeText(screen.getByLabelText('跟分身說需求或補充資訊'), '想吃熱湯');
  });
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '讓 Apple 分身整理' }));
  });
  await act(async () => {
    await fireEvent.changeText(screen.getByLabelText('跟分身說需求或補充資訊'), '預算改80');
  });
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '補充並重新整理' }));
  });
  expect(screen.getByLabelText('跟分身說需求或補充資訊').props.value).toBe('預算改80');
  expect(
    screen.getByRole('button', { name: '將摘要放入需求標題，再手動核對' }).props.accessibilityState
      .disabled,
  ).toBe(true);
  expect(apply).not.toHaveBeenCalled();
});

it('ignores a late result after the user stops generation', async () => {
  let resolve!: (value: typeof result) => void;
  jest.mocked(runAppleIntake).mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const screen = await render(<AppleStealthIntake disabled={false} onApplySummary={jest.fn()} />);
  await act(async () => {
    await fireEvent.changeText(screen.getByLabelText('跟分身說需求或補充資訊'), '想吃熱湯');
  });
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '讓 Apple 分身整理' }));
  });
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '停止整理' }));
    resolve(result);
  });
  expect(cancelAppleIntake).toHaveBeenCalled();
  expect(screen.queryByText(result.summary)).toBeNull();
  expect(screen.getByLabelText('跟分身說需求或補充資訊').props.value).toBe('想吃熱湯');
});

it('keeps the manual fallback available when Apple Intelligence is unavailable', async () => {
  jest.mocked(appleIntakeAvailability).mockResolvedValue('model_not_ready');
  const screen = await render(<AppleStealthIntake disabled={false} />);
  expect(
    screen.getByRole('button', { name: '讓 Apple 分身整理' }).props.accessibilityState.disabled,
  ).toBe(true);
  expect(screen.getByText(/可以隨時直接使用下方手動表單/)).toBeTruthy();
  expect(runAppleIntake).not.toHaveBeenCalled();
});

it('cancels on background and ignores a result arriving after returning to the foreground', async () => {
  let resolve!: (value: typeof result) => void;
  jest.mocked(runAppleIntake).mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const screen = await render(<AppleStealthIntake disabled={false} onApplySummary={jest.fn()} />);
  const onState = jest.mocked(AppState.addEventListener).mock.calls.at(-1)![1];
  await act(async () => {
    await fireEvent.changeText(screen.getByLabelText('跟分身說需求或補充資訊'), '想吃熱湯');
  });
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '讓 Apple 分身整理' }));
  });
  await act(async () => {
    onState('background');
    onState('active');
    resolve(result);
  });
  expect(cancelAppleIntake).toHaveBeenCalled();
  expect(screen.queryByText(result.summary)).toBeNull();
  expect(screen.getByLabelText('跟分身說需求或補充資訊').props.value).toBe('想吃熱湯');
});

it('lets the user repair the proposed title before explicitly adopting it', async () => {
  jest.mocked(runAppleIntake).mockResolvedValue(result);
  const apply = jest.fn();
  const screen = await render(<AppleStealthIntake disabled={false} onApplySummary={apply} />);
  await send(screen, '想喝熱湯，不方便取餐');
  await act(async () => {
    await fireEvent.changeText(screen.getByLabelText('核對後的需求標題'), '想喝熱湯，不願意取餐');
  });
  expect(apply).not.toHaveBeenCalled();
  expect(runAppleIntake).toHaveBeenCalledTimes(1);
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '將摘要放入需求標題，再手動核對' }));
  });
  expect(apply).toHaveBeenCalledWith('想喝熱湯，不願意取餐');
});

it('shows the complete long summary and asks for a short title instead of silently cutting a withdrawal', async () => {
  const summary = '想一起吃飯。'.repeat(30) + '但我不願意取餐。';
  jest.mocked(runAppleIntake).mockResolvedValue({ ...result, summary });
  const apply = jest.fn();
  const screen = await render(<AppleStealthIntake disabled={false} onApplySummary={apply} />);
  await send(screen, '想一起吃飯，但不取餐');
  expect(screen.getByText(summary)).toBeTruthy();
  expect(screen.getByLabelText('核對後的需求標題').props.value).toBe('');
  expect(
    screen.getByRole('button', { name: '將摘要放入需求標題，再手動核對' }).props.accessibilityState
      .disabled,
  ).toBe(true);
  await act(async () => {
    await fireEvent.changeText(screen.getByLabelText('核對後的需求標題'), '字'.repeat(161));
  });
  expect(screen.getByLabelText('核對後的需求標題').props.value).toHaveLength(161);
  expect(
    screen.getByRole('button', { name: '將摘要放入需求標題，再手動核對' }).props.accessibilityState
      .disabled,
  ).toBe(true);
  await act(async () => {
    await fireEvent.changeText(screen.getByLabelText('核對後的需求標題'), '吃飯，但不取餐');
  });
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '將摘要放入需求標題，再手動核對' }));
  });
  expect(apply).toHaveBeenCalledWith('吃飯，但不取餐');
});

it('retains an overlong paste and explains why generation is disabled', async () => {
  const screen = await render(<AppleStealthIntake disabled={false} />);
  const input = '字'.repeat(1001);
  await act(async () => {
    await fireEvent.changeText(screen.getByLabelText('跟分身說需求或補充資訊'), input);
  });
  expect(screen.getByLabelText('跟分身說需求或補充資訊').props.value).toBe(input);
  expect(screen.getByText(/本次輸入超過1000字/)).toBeTruthy();
  expect(
    screen.getByRole('button', { name: '讓 Apple 分身整理' }).props.accessibilityState.disabled,
  ).toBe(true);
  expect(runAppleIntake).not.toHaveBeenCalled();
});

it('allows repairing the last of eight turns without consuming a ninth turn', async () => {
  jest.mocked(runAppleIntake).mockResolvedValue(result);
  const screen = await render(<AppleStealthIntake disabled={false} />);
  for (let i = 0; i < 8; i += 1)
    await send(screen, `需求${i + 1}`, i ? '補充並重新整理' : '讓 Apple 分身整理');
  expect(screen.getByText(/已達八輪/)).toBeTruthy();
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '修改上一輪輸入' }));
  });
  expect(screen.getByLabelText('跟分身說需求或補充資訊').props.value).toBe('需求8');
  await send(screen, '更正，預算80元，不願意取餐', '更新上一輪並整理');
  const turns = jest.mocked(runAppleIntake).mock.calls.at(-1)![1];
  expect(turns).toEqual([
    '需求1',
    '需求2',
    '需求3',
    '需求4',
    '需求5',
    '需求6',
    '需求7',
    '更正，預算80元，不願意取餐',
  ]);
});

it('preserves the committed turn after a failed edit and restores its draft only when the user cancels the edit', async () => {
  jest
    .mocked(runAppleIntake)
    .mockResolvedValueOnce(result)
    .mockRejectedValueOnce(new Error('apple_ai_context_limit'));
  const apply = jest.fn();
  const screen = await render(<AppleStealthIntake disabled={false} onApplySummary={apply} />);
  await send(screen, '想吃熱湯');
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '修改上一輪輸入' }));
  });
  await send(screen, '想吃披薩，不願意取餐', '更新上一輪並整理');
  expect(screen.getByText('第1輪 · 你：想吃熱湯')).toBeTruthy();
  expect(screen.getByLabelText('跟分身說需求或補充資訊').props.value).toBe('想吃披薩，不願意取餐');
  expect(
    screen.getByRole('button', { name: '將摘要放入需求標題，再手動核對' }).props.accessibilityState
      .disabled,
  ).toBe(true);
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '取消本次修改' }));
  });
  expect(screen.getByLabelText('跟分身說需求或補充資訊').props.value).toBe('');
  expect(
    screen.getByRole('button', { name: '將摘要放入需求標題，再手動核對' }).props.accessibilityState
      .disabled,
  ).toBe(false);
  expect(apply).not.toHaveBeenCalled();
});

it('rechecks availability on foreground and ignores a stale check from before backgrounding', async () => {
  let resolveOld!: (status: string) => void;
  jest
    .mocked(appleIntakeAvailability)
    .mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolveOld = done;
        }),
    )
    .mockResolvedValueOnce('available');
  const screen = await render(<AppleStealthIntake disabled={false} />);
  const onState = jest.mocked(AppState.addEventListener).mock.calls.at(-1)![1];
  await act(async () => {
    onState('background');
    onState('active');
    resolveOld('model_not_ready');
  });
  expect(appleIntakeAvailability).toHaveBeenCalledTimes(2);
  expect(screen.getByText('Apple 裝置端 AI 已就緒')).toBeTruthy();
  expect(screen.queryByText(/模型尚未準備好/)).toBeNull();
});

it('retains a first failed input and retries it once without duplicating a conversation turn', async () => {
  jest
    .mocked(runAppleIntake)
    .mockRejectedValueOnce(new Error('apple_ai_generation_failed'))
    .mockResolvedValueOnce(result);
  const screen = await render(<AppleStealthIntake disabled={false} />);
  await send(screen, '想喝熱湯');
  expect(screen.getByLabelText('跟分身說需求或補充資訊').props.value).toBe('想喝熱湯');
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '讓 Apple 分身整理' }));
  });
  expect(jest.mocked(runAppleIntake).mock.calls[1][1]).toEqual(['想喝熱湯']);
  expect(screen.getByText('第1輪 · 你：想喝熱湯')).toBeTruthy();
});
