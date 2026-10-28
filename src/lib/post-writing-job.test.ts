import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { AxiosError } from 'axios';
import { api } from './api';
import { runPostWritingJob } from './post-writing-job';

jest.mock('./api', () => ({ api: { post: jest.fn(), get: jest.fn(), delete: jest.fn() } }));
jest.mock('./core-api', () => ({ newRequestKey: () => 'same-idempotency-key' }));
const queued = { id: 'own-job', status: 'queued', queue_position: 3 };
beforeEach(() => {
  jest.useFakeTimers();
  jest.mocked(api.delete).mockResolvedValue({ data: {} });
});
afterEach(() => {
  jest.useRealTimers();
  jest.resetAllMocks();
});

it('polls one account-owned job and reports queue progress until the result is ready', async () => {
  jest.mocked(api.post).mockResolvedValue({ data: queued });
  jest
    .mocked(api.get)
    .mockResolvedValueOnce({ data: { ...queued, status: 'running', queue_position: 0 } })
    .mockResolvedValueOnce({ data: { ...queued, status: 'succeeded', result: { text: 'draft' } } });
  const progress = jest.fn();
  const request = runPostWritingJob(
    { mode: 'voice', content: 'fixture' },
    { onProgress: progress },
  );
  await jest.advanceTimersByTimeAsync(6000);
  await expect(request).resolves.toEqual({ text: 'draft' });
  expect(progress.mock.calls.map(([p]) => p)).toEqual([
    { status: 'queued', queue_position: 3 },
    { status: 'running', queue_position: 0 },
  ]);
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(api.delete).not.toHaveBeenCalled();
});

it('retries a lost submission acknowledgement with the same key instead of duplicating inference', async () => {
  jest
    .mocked(api.post)
    .mockRejectedValueOnce(new AxiosError('offline'))
    .mockResolvedValueOnce({ data: { ...queued, status: 'succeeded', result: { text: 'draft' } } });
  await expect(runPostWritingJob({ mode: 'voice' })).resolves.toEqual({ text: 'draft' });
  const keys = jest
    .mocked(api.post)
    .mock.calls.map((call) => call[2]?.headers?.['Idempotency-Key']);
  expect(keys).toEqual(['same-idempotency-key', 'same-idempotency-key']);
});

it('cancels an owned pending job when its screen is closed', async () => {
  jest.mocked(api.post).mockResolvedValue({ data: queued });
  const controller = new AbortController();
  const request = runPostWritingJob({}, { signal: controller.signal });
  const rejected = expect(request).rejects.toThrow('post_writing_cancelled');
  await jest.advanceTimersByTimeAsync(0);
  controller.abort();
  await rejected;
  expect(api.delete).toHaveBeenCalledWith('/ai/post-writing/jobs/own-job', { timeout: 10_000 });
  expect(api.get).not.toHaveBeenCalled();
});

it('does not poll, return or cancel the previous account job after an account switch', async () => {
  jest.mocked(api.post).mockResolvedValue({ data: queued });
  let sameAccount = true;
  const request = runPostWritingJob({}, { canAccess: () => sameAccount });
  const rejected = expect(request).rejects.toThrow('post_writing_cancelled');
  await jest.advanceTimersByTimeAsync(0);
  sameAccount = false;
  await jest.advanceTimersByTimeAsync(3000);
  await rejected;
  expect(api.get).not.toHaveBeenCalled();
  expect(api.delete).not.toHaveBeenCalled();
});

it('keeps polling the same job after a temporary network interruption', async () => {
  jest.mocked(api.post).mockResolvedValue({ data: queued });
  jest
    .mocked(api.get)
    .mockRejectedValueOnce(new AxiosError('offline'))
    .mockResolvedValueOnce({ data: { ...queued, status: 'succeeded', result: { text: 'draft' } } });
  const request = runPostWritingJob({});
  await jest.advanceTimersByTimeAsync(9000);
  await expect(request).resolves.toEqual({ text: 'draft' });
  expect(api.post).toHaveBeenCalledTimes(1);
});
