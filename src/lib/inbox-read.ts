import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type { InboxPage, ThreadKind } from '@/lib/social-api';

/** Apply a confirmed read only when the inbox has not received a newer message. */
export async function updateInboxAfterRead(client: QueryClient, actor: string, kind: ThreadKind, id: string, messageId: string) {
  const key = ['core', actor, 'social-inbox'];
  await client.cancelQueries({ queryKey: key });
  client.setQueriesData<InfiniteData<InboxPage>>({ queryKey: key }, (old) => old && ({
    ...old,
    pages: old.pages.map((page) => {
      let cleared = 0;
      const items = page.items.map((item) => {
        if (item.kind !== kind || item.id !== id || item.last_message?.id !== messageId) return item;
        cleared += item.unread_count;
        return { ...item, unread_count: 0 };
      });
      return { ...page, items, total_unread: Math.max(0, page.total_unread - cleared) };
    }),
  }));
  void client.invalidateQueries({ queryKey: key });
  void client.invalidateQueries({ queryKey: ['core', actor, 'social-unread'] });
}
