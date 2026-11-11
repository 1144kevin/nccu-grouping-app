import { expect, it } from '@jest/globals';
import { QueryClient, type InfiniteData } from '@tanstack/react-query';
import { updateInboxAfterRead } from './inbox-read';
import type { InboxPage, InboxThread } from './social-api';

const thread = (id: string, message: string, unread: number) => ({ kind: 'group', id, last_message: { id: message }, unread_count: unread } as InboxThread);
it('immediately clears only the confirmed thread in each cached inbox', async () => {
  const client = new QueryClient();
  const key = ['core', 'user', 'social-inbox', 'all', false];
  client.setQueryData(key, { pages: [{ items: [thread('a', 'seen', 3), thread('b', 'other', 2)], total_unread: 5, next_cursor: null }], pageParams: [undefined] });
  await updateInboxAfterRead(client, 'user', 'group', 'a', 'seen');
  const page = client.getQueryData<InfiniteData<InboxPage>>(key)!.pages[0];
  expect(page.items.map((item) => item.unread_count)).toEqual([0, 2]);
  expect(page.total_unread).toBe(2);
});
it('does not erase a newer unread message', async () => {
  const client = new QueryClient();
  const key = ['core', 'user', 'social-inbox', 'all', false];
  client.setQueryData(key, { pages: [{ items: [thread('a', 'newer', 1)], total_unread: 1, next_cursor: null }], pageParams: [undefined] });
  await updateInboxAfterRead(client, 'user', 'group', 'a', 'older');
  expect(client.getQueryData<InfiniteData<InboxPage>>(key)!.pages[0].items[0].unread_count).toBe(1);
});
