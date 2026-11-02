import { api } from './api';

const DEVICE = 'nccu-grouping.push-device';
async function waitForWorker() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('web_push_unavailable')), 30_000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
function deviceId() {
  let id = localStorage.getItem(DEVICE);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE, id);
  }
  return id;
}
export function supportsWebPush() {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}
export async function enableWebPush() {
  if (!supportsWebPush()) throw new Error('web_push_not_supported');
  // Ask while still inside the user's tap, as required by iOS.
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('web_push_permission_denied');
  const key = (await api.get<{ public_key: string }>('/push/key')).data.public_key;
  const registration = await navigator.serviceWorker.register('/push-sw.js', { scope: '/' });
  await waitForWorker();
  const previous = await registration.pushManager.getSubscription();
  const subscription =
    previous ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: Uint8Array.from(
        atob(key.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (key.length % 4)) % 4)),
        (c) => c.charCodeAt(0),
      ),
    }));
  const json = subscription.toJSON();
  const previousId = localStorage.getItem(DEVICE);
  try {
    await api.post('/push/subscribe', {
      device_id: deviceId(),
      subscription: { endpoint: json.endpoint, keys: json.keys },
    });
  } catch (error) {
    if (!previous) await subscription.unsubscribe().catch(() => undefined);
    if (!previousId) localStorage.removeItem(DEVICE);
    throw error;
  }
}
export async function disablePushForLogout() {
  if (!supportsWebPush()) return;
  const id = localStorage.getItem(DEVICE);
  if (!id) return;
  try {
    await api.post('/push/unsubscribe', { device_id: id });
  } finally {
    // Stop delivery on this phone even if its login session has already expired.
    const registration = await navigator.serviceWorker.getRegistration('/');
    await (await registration?.pushManager.getSubscription())?.unsubscribe();
    localStorage.removeItem(DEVICE);
  }
}
export async function sendTestPush() {
  await api.post('/push/test', { device_id: deviceId() });
}
export async function hasWebPush() {
  if (!supportsWebPush() || Notification.permission !== 'granted' || !localStorage.getItem(DEVICE))
    return false;
  return !!(await (
    await navigator.serviceWorker.getRegistration('/')
  )?.pushManager.getSubscription());
}
