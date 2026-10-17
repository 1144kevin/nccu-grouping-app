export type StoredSession = { access_token: string; refresh_token?: string | null };

// Serialize writes and compare inside the queue: a refresh must never resurrect a
// session cleared by logout or overwrite a newly signed-in account.
export function createSessionStorage(read: () => Promise<string | null>, write: (value: string) => Promise<void>, remove: () => Promise<void>) {
  let queue: Promise<unknown> = Promise.resolve();
  const exclusive = <T,>(work: () => Promise<T>): Promise<T> => {
    const result = queue.then(work, work);
    queue = result.catch(() => undefined);
    return result;
  };
  const decode = (raw: string | null): StoredSession | null => {
    if (!raw) return null;
    if (!raw.startsWith('{')) return { access_token: raw }; // Existing sessions.
    try {
      const value = JSON.parse(raw);
      return typeof value.access_token === 'string' && value.access_token
        ? { access_token: value.access_token, refresh_token: typeof value.refresh_token === 'string' ? value.refresh_token : null } : null;
    } catch { return null; }
  };
  const load = async () => decode(await read());
  return {
    get: async () => { await queue; return (await load())?.access_token ?? null; },
    getRefresh: async () => { await queue; return (await load())?.refresh_token ?? null; },
    set: (token: string) => exclusive(() => write(JSON.stringify({ access_token: token }))),
    setSession: (session: StoredSession) => exclusive(() => write(JSON.stringify({ access_token: session.access_token, refresh_token: session.refresh_token ?? null }))),
    replace: (expected: string, session: StoredSession) => exclusive(async () => {
      if ((await load())?.access_token !== expected) return false;
      await write(JSON.stringify({ access_token: session.access_token, refresh_token: session.refresh_token ?? null }));
      return true;
    }),
    clear: () => exclusive(remove),
  };
}
