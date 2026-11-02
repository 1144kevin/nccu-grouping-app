import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

function worker() {
  const events = {};
  const notifications = [];
  const badges = [];
  const navigations = [];
  const client = {
    url: 'https://campus.test/',
    navigate: async (url) => {
      navigations.push(url);
    },
    focus: async () => {},
  };
  const self = {
    location: { origin: 'https://campus.test' },
    addEventListener: (name, fn) => {
      events[name] = fn;
    },
    registration: {
      showNotification: async (title, value) => {
        notifications.push({ title, ...value });
      },
    },
    navigator: {
      setAppBadge: async (value) => {
        badges.push(value);
      },
    },
    clients: {
      claim: async () => {},
      matchAll: async () => [client],
      openWindow: async (url) => {
        navigations.push(url);
      },
    },
    skipWaiting: async () => {},
  };
  vm.runInNewContext(readFileSync(new URL('../public/push-sw.js', import.meta.url), 'utf8'), {
    self,
    URL,
    Promise,
  });
  return { events, notifications, badges, navigations };
}
test('push shows an acceptance notification and opens the matching order on tap', async () => {
  const w = worker();
  let work;
  const route = '/order/00000000-0000-4000-8000-000000000001';
  w.events.push({
    data: { json: () => ({ title: '政缺一咖', body: '申請已獲接受', url: route, badge: 1 }) },
    waitUntil: (p) => {
      work = p;
    },
  });
  await work;
  assert.equal(w.notifications[0].data.url, route);
  assert.equal(w.badges[0], 1);
  w.events.notificationclick({
    notification: { close: () => {}, data: w.notifications[0].data },
    waitUntil: (p) => {
      work = p;
    },
  });
  await work;
  assert.equal(w.navigations[0], 'https://campus.test' + route);
});
test('untrusted notification routes cannot open an external website', async () => {
  const w = worker();
  let work;
  w.events.push({
    data: { json: () => ({ url: 'https://attacker.test/', badge: 0 }) },
    waitUntil: (p) => {
      work = p;
    },
  });
  await work;
  assert.equal(w.notifications[0].data.url, '/notifications');
});
