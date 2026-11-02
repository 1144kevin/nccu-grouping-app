// Installed iOS Web Apps outlive a tab. IndexedDB preserves their refresh session
// across process termination; ordinary tabs retain isolated sessionStorage.
export function isInstalledWebApp(): boolean {
  return (
    typeof window !== 'undefined' &&
    ((window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
      window.matchMedia?.('(display-mode: standalone)').matches === true)
  );
}

export function createInstalledSessionStorage(factory: IDBFactory | undefined) {
  const unavailable = () => new Error('web_session_storage_unavailable');
  function transaction<T>(
    mode: IDBTransactionMode,
    work: (store: IDBObjectStore, done: (value: T) => void) => void,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!factory) {
        reject(unavailable());
        return;
      }
      let database: IDBDatabase | undefined;
      let tx: IDBTransaction | undefined;
      let settled = false;
      let value: T;
      const fail = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try {
          tx?.abort();
        } catch {
          /* Already completed. */
        }
        database?.close();
        reject(unavailable());
      };
      const timer = setTimeout(fail, 4000);
      try {
        const request = factory.open('nccu-grouping.installed-auth', 1);
        request.onerror = fail;
        request.onblocked = fail;
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains('session'))
            request.result.createObjectStore('session');
        };
        request.onsuccess = () => {
          database = request.result;
          if (settled) {
            database.close();
            return;
          }
          try {
            tx = database.transaction('session', mode);
            tx.onerror = fail;
            tx.onabort = fail;
            tx.oncomplete = () => {
              if (settled) return;
              settled = true;
              clearTimeout(timer);
              database?.close();
              resolve(value);
            };
            work(tx.objectStore('session'), (result) => {
              value = result;
            });
          } catch {
            fail();
          }
        };
      } catch {
        fail();
      }
    });
  }
  return {
    read: () =>
      transaction<string | null>('readonly', (store, done) => {
        const request = store.get('current');
        request.onsuccess = () => done(typeof request.result === 'string' ? request.result : null);
      }),
    write: (value: string) =>
      transaction<void>('readwrite', (store) => {
        store.put(value, 'current');
      }),
    remove: () =>
      transaction<void>('readwrite', (store) => {
        store.delete('current');
      }),
    replace: (expected: string, value: string) =>
      transaction<boolean>('readwrite', (store, done) => {
        const request = store.get('current');
        request.onsuccess = () => {
          const raw = request.result;
          let token: unknown = raw;
          try {
            if (typeof raw === 'string' && raw.startsWith('{'))
              token = JSON.parse(raw).access_token;
          } catch {
            token = null;
          }
          if (token !== expected) {
            done(false);
            return;
          }
          store.put(value, 'current');
          done(true);
        };
      }),
  };
}
