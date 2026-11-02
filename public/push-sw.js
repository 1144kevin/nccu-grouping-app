/* Only notifications; no page/API caching or authentication credentials. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    /* Generic notification below. */
  }
  const url = /^\/(?:order|chat|direct-chat|stealth-chat)\/[a-f0-9-]{36}$/.test(data.url ?? '')
    ? data.url
    : '/notifications';
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title || '政缺一咖', {
        body: data.body || '你有新的拼單通知',
        tag: data.tag || 'grouping',
        data: { url },
        icon: '/app-icon.svg',
      }),
      self.navigator.setAppBadge?.(Math.max(0, Number(data.badge) || 0)) ?? Promise.resolve(),
    ]),
  );
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/notifications', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windows) => {
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
