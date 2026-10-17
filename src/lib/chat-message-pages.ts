import type { CoreChatPage, CoreMessage } from './core-api';

// Preserve database ordering at microsecond precision across paginated results.
export function chatMessagesNewestFirst(pages: readonly CoreChatPage[]): CoreMessage[] {
  const messages = new Map<string, CoreMessage>();
  for (const page of [...pages].reverse()) {
    for (const message of page.messages) messages.set(message.id, message);
  }
  return [...messages.values()].reverse();
}
