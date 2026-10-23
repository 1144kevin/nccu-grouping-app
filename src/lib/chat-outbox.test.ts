import { expect, it } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import { useChatOutbox } from './chat-outbox';

type Message = { id: string; content: string; created_at: string };
const draft: Message = {
  id: 'local:key',
  content: '六點正門見',
  created_at: '2026-10-23T10:00:00Z',
};

it('keeps pending and confirmed messages visible across stale snapshots, then deduplicates the server acknowledgement', async () => {
  const screen = await renderHook(({ server }: { server: Message[] }) => useChatOutbox(server), {
    initialProps: { server: [] },
  });
  await act(() => screen.result.current.begin('key', draft));
  expect(screen.result.current.items[0].delivery).toBe('sending');
  await act(() => screen.result.current.confirm('key', { id: 'server-id' }));
  await screen.rerender({ server: [] });
  expect(screen.result.current.items).toEqual([{ ...draft, id: 'server-id', delivery: undefined }]);
  await screen.rerender({ server: [{ ...draft, id: 'server-id', content: '伺服器已確認' }] });
  expect(screen.result.current.items).toEqual([
    { ...draft, id: 'server-id', content: '伺服器已確認' },
  ]);
});

it('shows failure and replaces the same retry without duplicating it', async () => {
  const screen = await renderHook(() => useChatOutbox<Message>([]));
  await act(() => screen.result.current.begin('key', draft));
  await act(() => screen.result.current.fail('key'));
  expect(screen.result.current.items[0].delivery).toBe('failed');
  await act(() => screen.result.current.begin('key', draft));
  expect(screen.result.current.items).toHaveLength(1);
  expect(screen.result.current.items[0].delivery).toBe('sending');
});
