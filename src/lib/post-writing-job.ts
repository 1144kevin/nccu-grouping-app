import { isAxiosError } from 'axios';
import { api } from '@/lib/api';
import { newRequestKey } from '@/lib/core-api';

export type WritingProgress = { status: 'queued' | 'running'; queue_position: number };
type Draft = {
  text: string;
  source_text?: string;
  draft_method?: 'model' | 'recognized_facts' | 'spoken_facts';
};
type Job = {
  id: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  queue_position: number;
  result?: Draft | null;
  error?: string | null;
};
export type WritingOptions = {
  signal?: AbortSignal;
  onProgress?: (progress: WritingProgress) => void;
  canAccess?: () => boolean;
};

function pause(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      reject(new Error('post_writing_cancelled'));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
  });
}

export async function runPostWritingJob(
  value: object,
  options: WritingOptions = {},
): Promise<Draft> {
  const { signal, onProgress, canAccess = () => true } = options;
  const active = () => !signal?.aborted && canAccess();
  if (!active()) throw new Error('post_writing_cancelled');
  const key = newRequestKey();
  let job: Job | undefined;
  let completed = false;
  const deadline = Date.now() + 20 * 60_000;
  try {
    // Retry a lost acknowledgement with the same key, never enqueue a duplicate.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        job = (
          await api.post<Job>('/ai/post-writing/jobs', value, {
            headers: { 'Idempotency-Key': key },
            timeout: 30_000,
          })
        ).data;
        break;
      } catch (error) {
        if (
          attempt ||
          !active() ||
          !isAxiosError(error) ||
          (error.response && ![502, 503, 504].includes(error.response.status))
        )
          throw error;
      }
    }
    if (!job) throw new Error('post_writing_failed');
    let failures = 0;
    while (true) {
      if (!active()) throw new Error('post_writing_cancelled');
      if (job.status === 'succeeded' && job.result) {
        completed = true;
        return job.result;
      }
      if (job.status === 'failed') throw new Error(job.error || 'post_writing_failed');
      if (job.status === 'cancelled') throw new Error('post_writing_cancelled');
      if (Date.now() >= deadline) throw new Error('post_writing_wait_timeout');
      if (job.status === 'queued' || job.status === 'running')
        onProgress?.({ status: job.status, queue_position: job.queue_position });
      await pause(3000, signal);
      if (!active()) throw new Error('post_writing_cancelled');
      try {
        job = (
          await api.get<Job>(`/ai/post-writing/jobs/${encodeURIComponent(job.id)}`, { signal })
        ).data;
        failures = 0;
      } catch (error) {
        if (
          !active() ||
          !isAxiosError(error) ||
          (error.response && ![429, 502, 503, 504].includes(error.response.status)) ||
          ++failures > 3
        )
          throw error;
        await pause(failures * 3000, signal);
      }
    }
  } finally {
    if (!completed && job && canAccess()) {
      void api
        .delete(`/ai/post-writing/jobs/${encodeURIComponent(job.id)}`, { timeout: 10_000 })
        .catch(() => undefined);
    }
  }
}
