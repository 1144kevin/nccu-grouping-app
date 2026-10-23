import { useCallback, useMemo, useState } from 'react';

type Message = { id: string; created_at: string };
export type ChatDisplay<T> = T & { delivery?: 'sending' | 'failed'; local_image_uri?: string };
type Entry<T> = { key: string; state: 'sending' | 'failed' | 'sent'; message: ChatDisplay<T> };

// Keep acknowledged messages visible until a server snapshot contains them. A slow or
// older polling response must not make a just-sent message disappear from the screen.
export function useChatOutbox<T extends Message>(server: T[], newestFirst = true) {
  const [entries, setEntries] = useState<Entry<T>[]>([]);
  const begin = useCallback((key: string, message: ChatDisplay<T>) => {
    setEntries((old) =>
      [
        ...old.filter((e) => e.key !== key && e.state !== 'failed'),
        { key, message, state: 'sending' as const },
      ].slice(-30),
    );
  }, []);
  const confirm = useCallback((key: string, message: Partial<T> & { id: string }) => {
    setEntries((old) =>
      old.map((e) =>
        e.key === key ? { ...e, state: 'sent', message: { ...e.message, ...message } } : e,
      ),
    );
  }, []);
  const fail = useCallback(
    (key: string) =>
      setEntries((old) => old.map((e) => (e.key === key ? { ...e, state: 'failed' } : e))),
    [],
  );
  const items = useMemo(() => {
    const combined = new Map<string, ChatDisplay<T>>(server.map((m) => [m.id, m]));
    for (const e of entries) {
      // The server is authoritative once it includes this receipt. Retaining a bounded
      // local receipt also protects against a later, older in-flight poll response.
      if (e.state === 'sent' && combined.has(e.message.id)) continue;
      combined.set(e.message.id, {
        ...e.message,
        delivery: e.state === 'sent' ? undefined : e.state,
      });
    }
    return [...combined.values()].sort((a, b) => {
      const order = Date.parse(b.created_at) - Date.parse(a.created_at);
      return newestFirst ? order : -order;
    });
  }, [server, entries, newestFirst]);
  return { items, begin, confirm, fail };
}
