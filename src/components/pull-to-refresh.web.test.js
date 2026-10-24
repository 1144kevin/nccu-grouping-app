/** @jest-environment jsdom */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, jest } from '@jest/globals';
import { PullToRefresh } from './pull-to-refresh.web';

jest.mock('react-native', () => {
  const React = require('react');
  return {
    View: ({ children, style }) => React.createElement('div', { style }, children),
    ActivityIndicator: () => React.createElement('span', null, 'loading'),
    Platform: { OS: 'web', select: (values) => values.web ?? values.default },
  };
});
jest.mock('@/components/app-text', () => ({
  AppText: ({ children }) => require('react').createElement('span', null, children),
}));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// Expo's native fetch getter must not initialize while jsdom closes its window.
Object.defineProperty(globalThis, 'fetch', {
  configurable: true,
  writable: true,
  value: jest.fn(),
});
let root;
let container;
async function mount(onRefresh) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      React.createElement(
        PullToRefresh,
        { onRefresh },
        React.createElement(
          'div',
          { id: 'feed', style: { overflowY: 'auto' } },
          React.createElement(
            'div',
            { id: 'photo', style: { overflowY: 'hidden', overflowX: 'auto' } },
            'photo',
          ),
        ),
      ),
    ),
  );
  return { feed: container.querySelector('#feed'), photo: container.querySelector('#photo') };
}
async function touch(element, type, x, y) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'touches', {
    value: type === 'touchend' ? [] : [{ clientX: x, clientY: y }],
  });
  await act(async () => element.dispatchEvent(event));
}
afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
});

it('refreshes once for a deliberate top-edge pull and keeps the spinner until the request completes', async () => {
  let finish;
  const refresh = jest.fn(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const { feed } = await mount(refresh);
  await touch(feed, 'touchstart', 100, 100);
  await touch(feed, 'touchmove', 100, 250);
  expect(container.textContent).toContain('放開即可更新');
  await touch(feed, 'touchend', 100, 250);
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(container.textContent).toContain('loading');
  await touch(feed, 'touchstart', 100, 100);
  await touch(feed, 'touchmove', 100, 250);
  await touch(feed, 'touchend', 100, 250);
  expect(refresh).toHaveBeenCalledTimes(1);
  await act(async () => finish());
  expect(container.textContent).not.toContain('loading');
});

it('does not refresh mid-list, on horizontal photo swipes, short pulls or cancelled touches', async () => {
  const refresh = jest.fn();
  const { feed, photo } = await mount(refresh);
  feed.scrollTop = 120;
  await touch(feed, 'touchstart', 100, 100);
  await touch(feed, 'touchmove', 100, 300);
  await touch(feed, 'touchend', 100, 300);
  feed.scrollTop = 0;
  await touch(photo, 'touchstart', 100, 100);
  await touch(photo, 'touchmove', 280, 130);
  await touch(photo, 'touchend', 280, 130);
  await touch(feed, 'touchstart', 100, 100);
  await touch(feed, 'touchmove', 100, 130);
  await touch(feed, 'touchend', 100, 130);
  await touch(feed, 'touchstart', 100, 100);
  await touch(feed, 'touchmove', 100, 300);
  await touch(feed, 'touchcancel', 100, 300);
  await touch(feed, 'touchend', 100, 300);
  expect(refresh).not.toHaveBeenCalled();
});
