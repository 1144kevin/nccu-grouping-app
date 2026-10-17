import { expect, it } from '@jest/globals';
import { chatMessagesNewestFirst } from './chat-message-pages';
import type { CoreChatPage, CoreMessage } from './core-api';

const message = (id: string, created_at: string, sender_name = '主揪'): CoreMessage => ({ id, created_at, sender_name, post_id: 'p', sender_id: 'a', sender_badge: '🍱', content: id });
const page = (messages: CoreMessage[]) => ({ messages } as CoreChatPage);

it('preserves server chronology below millisecond precision and deduplicates overlapping pages', () => {
  const older = page([message('z-oldest', '2026-10-17T12:00:00Z'), message('z-overlap', '2026-10-17T12:00:00.000050Z')]);
  const newest = page([message('z-overlap', '2026-10-17T12:00:00.000050Z', '更新後名稱'), message('a-later', '2026-10-17T12:00:00.000900Z'), message('a-newest', '2026-10-17T12:00:01Z')]);
  const result = chatMessagesNewestFirst([newest, older]);
  expect(result.map((item) => item.id)).toEqual(['a-newest', 'a-later', 'z-overlap', 'z-oldest']);
  expect(result.find((item) => item.id === 'z-overlap')?.sender_name).toBe('更新後名稱');
});
