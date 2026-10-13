import type { Conversation, InboxType } from '@/types/domain';

export function sortedConversations(conversations: Conversation[], inbox: 'all' | InboxType) {
  return conversations.filter((item) => inbox === 'all' || item.inbox === inbox)
    .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
}
