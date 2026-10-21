import { afterEach, expect, it, jest } from '@jest/globals';
import { requireOptionalNativeModule } from 'expo';
import {
  appleIntakeAvailability,
  cancelAppleIntake,
  newAppleIntakeRequestID,
  runAppleIntake,
} from './apple-intake';
jest.mock('expo', () => {
  const native = { interview: jest.fn(), availability: jest.fn(), cancel: jest.fn() };
  return { requireOptionalNativeModule: () => native };
});
const native = requireOptionalNativeModule('NCCUAppleIntake') as {
  interview: ReturnType<typeof jest.fn<(...args: unknown[]) => Promise<unknown>>>;
  availability: ReturnType<typeof jest.fn<() => Promise<string>>>;
  cancel: ReturnType<typeof jest.fn>;
};
const complete = {
  summary: '想吃熱湯',
  questions: [],
  provider: 'apple_on_device',
  elapsedMs: 1200,
};
afterEach(() => {
  jest.resetAllMocks();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it('rejects oversized conversation before invoking the native model', async () => {
  await expect(runAppleIntake('test', ['字'.repeat(1001)])).rejects.toThrow(
    'apple_ai_input_too_long',
  );
  await expect(runAppleIntake('test', Array(9).fill('餐點'))).rejects.toThrow(
    'apple_ai_turn_limit',
  );
  expect(native.interview).not.toHaveBeenCalled();
});
it('rejects malformed output rather than allowing it into the form', async () => {
  native.interview.mockResolvedValue({ summary: '', questions: [], provider: 'apple_on_device' });
  await expect(runAppleIntake('test', ['熱湯'])).rejects.toThrow('apple_ai_invalid_output');
});
it('cancels the native generation when the request times out', async () => {
  jest.useFakeTimers();
  native.interview.mockImplementation(() => new Promise(() => {}));
  const pending = expect(runAppleIntake('timed', ['熱湯'])).rejects.toThrow('apple_ai_timeout');
  await jest.advanceTimersByTimeAsync(60_000);
  await pending;
  expect(native.cancel).toHaveBeenCalledWith('timed');
});

it('freezes user turns before asynchronous bridge dispatch', async () => {
  native.interview.mockResolvedValue(complete);
  const turns = ['想吃熱湯'];
  const pending = runAppleIntake('snapshot', turns);
  turns[0] = '未提交的更正';
  await pending;
  expect(native.interview).toHaveBeenCalledWith('snapshot', ['想吃熱湯']);
});

it('releases the timer after a native failure so a later request is not cancelled', async () => {
  jest.useFakeTimers();
  native.interview.mockRejectedValue(new Error('apple_ai_context_limit'));
  await expect(runAppleIntake('failed', ['熱湯'])).rejects.toThrow('apple_ai_context_limit');
  await jest.advanceTimersByTimeAsync(60_000);
  expect(native.cancel).not.toHaveBeenCalled();
});

it('times out availability checks without cancelling an unrelated generation', async () => {
  jest.useFakeTimers();
  native.availability.mockImplementation(() => new Promise(() => {}));
  const pending = expect(appleIntakeAvailability()).rejects.toThrow(
    'apple_ai_availability_timeout',
  );
  await jest.advanceTimersByTimeAsync(5_000);
  await pending;
  expect(native.cancel).not.toHaveBeenCalled();
});

it('does not let a bridge cancellation failure mask timeout or local recovery', async () => {
  jest.useFakeTimers();
  native.cancel.mockImplementation(() => {
    throw new Error('module detached');
  });
  expect(() => cancelAppleIntake('old')).not.toThrow();
  native.interview.mockImplementation(() => new Promise(() => {}));
  const pending = expect(runAppleIntake('timed', ['熱湯'])).rejects.toThrow('apple_ai_timeout');
  await jest.advanceTimersByTimeAsync(60_000);
  await pending;
});

it('uses distinct request IDs even when remounts occur in the same millisecond', () => {
  jest.spyOn(Date, 'now').mockReturnValue(1000);
  expect(newAppleIntakeRequestID()).not.toBe(newAppleIntakeRequestID());
});

it('dispatches a request before a same-turn cancellation so the native request ID can be cancelled', async () => {
  native.interview.mockRejectedValue(new Error('apple_ai_cancelled'));
  const pending = expect(runAppleIntake('early-stop', ['熱湯'])).rejects.toThrow(
    'apple_ai_cancelled',
  );
  cancelAppleIntake('early-stop');
  await pending;
  expect(native.interview.mock.invocationCallOrder[0]).toBeLessThan(
    native.cancel.mock.invocationCallOrder[0],
  );
  expect(native.cancel).toHaveBeenCalledWith('early-stop');
});
