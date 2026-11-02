import { afterEach, expect, it, jest } from '@jest/globals';
import { createInstalledSessionStorage } from './installed-session-storage.web';

// A persistent database outlives individual storage objects and browser windows.
// This small event-driven fake supplies IDB transactions without network/storage.
function databaseFixture() {
  const data = new Map<string, string>();
  const factory = {
    open: () => {
      const request: Record<string, any> = {};
      queueMicrotask(() => {
        request.result = {
          close: jest.fn(),
          transaction: () => {
            const tx: Record<string, any> = { abort: jest.fn() };
            let completed = false;
            const finish = () =>
              setTimeout(() => {
                if (!completed) {
                  completed = true;
                  tx.oncomplete?.();
                }
              }, 0);
            tx.objectStore = () => ({
              get: (key: string) => {
                const read: Record<string, any> = {};
                queueMicrotask(() => {
                  read.result = data.get(key);
                  read.onsuccess?.();
                  finish();
                });
                return read;
              },
              put: (value: string, key: string) => {
                data.set(key, value);
                finish();
              },
              delete: (key: string) => {
                data.delete(key);
                finish();
              },
            });
            return tx;
          },
        };
        request.onsuccess?.();
      });
      return request;
    },
  } as unknown as IDBFactory;
  return { factory, data };
}

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
  else Reflect.deleteProperty(globalThis, 'window');
  jest.useRealTimers();
});

it('restores an installed app session after the page and its temporary storage are destroyed', async () => {
  const { factory } = databaseFixture();
  let temporary = new Map<string, string>();
  const openWindow = () =>
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        navigator: { standalone: true },
        indexedDB: factory,
        sessionStorage: {
          getItem: (key: string) => temporary.get(key) ?? null,
          setItem: (key: string, value: string) => temporary.set(key, value),
          removeItem: (key: string) => temporary.delete(key),
        },
      },
    });
  async function reload() {
    let storage!: typeof import('./token-storage.web').tokenStorage;
    jest.isolateModules(() => {
      storage =
        jest.requireActual<typeof import('./token-storage.web')>(
          './token-storage.web',
        ).tokenStorage;
    });
    return storage;
  }
  openWindow();
  const first = await reload();
  await first.setSession({ access_token: 'synthetic-access', refresh_token: 'synthetic-refresh' });
  temporary = new Map();
  openWindow();
  const reopened = await reload();
  expect(await reopened.get()).toBe('synthetic-access');
  expect(await reopened.getRefresh()).toBe('synthetic-refresh');
  expect(
    await reopened.replace('synthetic-access', {
      access_token: 'rotated',
      refresh_token: 'rotated-refresh',
    }),
  ).toBe(true);
  expect(await (await reload()).getRefresh()).toBe('rotated-refresh');
  await reopened.clear();
  expect(await (await reload()).get()).toBeNull();
  expect(await first.replace('synthetic-access', { access_token: 'late-old-response' })).toBe(
    false,
  );
});

it('does not overwrite a different session with an old refresh response', async () => {
  const { factory } = databaseFixture();
  const one = createInstalledSessionStorage(factory);
  await one.write(JSON.stringify({ access_token: 'new-account' }));
  const stale = createInstalledSessionStorage(factory);
  expect(await stale.replace('old-account', JSON.stringify({ access_token: 'late' }))).toBe(false);
  expect(JSON.parse((await one.read())!).access_token).toBe('new-account');
});

it('migrates an existing installed login without keeping a stale temporary copy', async () => {
  const { factory } = databaseFixture();
  const key = 'nccu-grouping.local-core.access-token';
  const temporary = new Map([
    [key, JSON.stringify({ access_token: 'existing', refresh_token: 'existing-refresh' })],
  ]);
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      navigator: { standalone: true },
      indexedDB: factory,
      sessionStorage: {
        getItem: (key: string) => temporary.get(key) ?? null,
        removeItem: (key: string) => temporary.delete(key),
      },
    },
  });
  let storage!: typeof import('./token-storage.web').tokenStorage;
  jest.isolateModules(() => {
    storage =
      jest.requireActual<typeof import('./token-storage.web')>('./token-storage.web').tokenStorage;
  });
  expect(await storage.get()).toBe('existing');
  expect(temporary.size).toBe(0);
  expect(await storage.getRefresh()).toBe('existing-refresh');
});

it('keeps ordinary browser tabs isolated from an installed session', async () => {
  const { factory } = databaseFixture();
  await createInstalledSessionStorage(factory).write(
    JSON.stringify({ access_token: 'installed-account' }),
  );
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      navigator: { standalone: false },
      indexedDB: factory,
      sessionStorage: { getItem: () => JSON.stringify({ access_token: 'browser-account' }) },
    },
  });
  let storage!: typeof import('./token-storage.web').tokenStorage;
  jest.isolateModules(() => {
    storage =
      jest.requireActual<typeof import('./token-storage.web')>('./token-storage.web').tokenStorage;
  });
  expect(await storage.get()).toBe('browser-account');
});

it('fails promptly if persistent storage is unsupported or blocked', async () => {
  await expect(createInstalledSessionStorage(undefined).read()).rejects.toThrow(
    'web_session_storage_unavailable',
  );
  jest.useFakeTimers();
  const neverOpens = { open: () => ({}) } as unknown as IDBFactory;
  const read = createInstalledSessionStorage(neverOpens).read();
  const check = expect(read).rejects.toThrow('web_session_storage_unavailable');
  jest.advanceTimersByTime(4000);
  await check;
});
