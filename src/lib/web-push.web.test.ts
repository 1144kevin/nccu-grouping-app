import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { api } from './api';
import { disablePushForLogout, enableWebPush, hasWebPush } from './web-push.web';

jest.mock('./api', () => ({ api: { get: jest.fn(), post: jest.fn() } }));

const saved = new Map<string, PropertyDescriptor | undefined>();
const storage = new Map<string, string>();
const unsubscribe = jest.fn<() => Promise<boolean>>();
const subscribe = jest.fn<() => Promise<object>>();
const registration = {
  pushManager: {
    getSubscription: jest.fn<() => Promise<object | null>>(),
    subscribe,
  },
};
let ready: Promise<typeof registration>;
function replace(name: string, value: unknown) {
  saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, { configurable: true, value });
}
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  storage.clear();
  ready = Promise.resolve(registration);
  replace('window', { isSecureContext: true, PushManager: function () {}, Notification: {} });
  replace('navigator', {
    serviceWorker: {
      register: jest.fn(async () => registration),
      getRegistration: jest.fn(async () => registration),
      get ready() {
        return ready;
      },
    },
  });
  replace('Notification', {
    permission: 'granted',
    requestPermission: jest.fn(async () => 'granted'),
  });
  replace('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  replace('crypto', { randomUUID: () => 'test-device' });
  replace('atob', () => 'public-key');
  unsubscribe.mockResolvedValue(true);
  registration.pushManager.getSubscription.mockResolvedValue(null);
  subscribe.mockResolvedValue({
    unsubscribe,
    toJSON: () => ({ endpoint: 'https://web.push.apple.com/test', keys: {} }),
  });
  jest.mocked(api.get).mockResolvedValue({ data: { public_key: 'public-key' } });
  jest.mocked(api.post).mockResolvedValue({ data: {} });
});
afterEach(() => {
  for (const [name, descriptor] of saved) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
  saved.clear();
  jest.useRealTimers();
});

it('undoes a new phone subscription when server registration fails, allowing retry', async () => {
  jest.mocked(api.post).mockRejectedValueOnce(new Error('network'));
  await expect(enableWebPush()).rejects.toThrow('network');
  expect(unsubscribe).toHaveBeenCalledTimes(1);
  expect(await hasWebPush()).toBe(false);
  await enableWebPush();
  expect(api.post).toHaveBeenLastCalledWith(
    '/push/subscribe',
    expect.objectContaining({ device_id: 'test-device' }),
  );
});

it('unsubscribes on the phone even when its server session has expired', async () => {
  storage.set('nccu-grouping.push-device', 'test-device');
  registration.pushManager.getSubscription.mockResolvedValue({ unsubscribe });
  jest.mocked(api.post).mockRejectedValueOnce(new Error('expired session'));
  await expect(disablePushForLogout()).rejects.toThrow('expired session');
  expect(unsubscribe).toHaveBeenCalledTimes(1);
  expect(await hasWebPush()).toBe(false);
});

it('stops waiting for a worker that never activates', async () => {
  ready = new Promise(() => {});
  const attempt = enableWebPush();
  const result = expect(attempt).rejects.toThrow('web_push_unavailable');
  await jest.advanceTimersByTimeAsync(30_000);
  await result;
  expect(subscribe).not.toHaveBeenCalled();
});
