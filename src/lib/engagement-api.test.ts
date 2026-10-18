import { expect, it, jest } from '@jest/globals';
import { recommendationCandidates, visibleChatActivity, type AccountPreferences } from './engagement-api';
import type { CorePost } from './core-api';
jest.mock('./api', () => ({ api: {} }));
jest.mock('./core-hooks', () => ({ useCoreScreenFocused: () => false }));
jest.mock('@/store/auth-store', () => ({ useAuthStore: () => null }));
const prefs: AccountPreferences = {
  version: 1,
  preferred_tags: [],
  notifications: {
    messages: true,
    joinRequests: true,
    recommendations: false,
    deadlineReminders: false,
    stealthInvites: true,
  },
};

it('keeps only joinable recommended groups without mutating the latest feed', () => {
  const records = [
    { id:'open',status:'open',capacity:3,joined:1 },
    { id:'full',status:'full',capacity:3,joined:3 },
    { id:'stale',status:'open',capacity:3,joined:3 },
    { id:'expired',status:'expired',capacity:3,joined:1 },
    { id:'cancelled',status:'cancelled',capacity:3,joined:1 },
  ] as CorePost[];
  expect(recommendationCandidates(records).map((r)=>r.id)).toEqual(['open']);
  expect(records).toHaveLength(5);
});
const value = {
  groups: [
    { post_id: 'a', unread_count: 3 },
    { post_id: 'b', unread_count: 4 },
    { post_id: 'c', unread_count: 2 },
  ],
  total_unread: 9,
  pending_requests: 1,
};
it('muting and archiving only affect own badge calculation, not read cursors or membership', () => {
  const result = visibleChatActivity(
    value,
    [
      { post_id: 'a', muted: true, archived: false },
      { post_id: 'b', muted: false, archived: true },
    ],
    prefs,
  );
  expect(result.total_unread).toBe(2);
  expect(result.groups).toEqual([{ post_id: 'c', unread_count: 2 }]);
  expect(value.total_unread).toBe(9);
  expect(result.pending_requests).toBe(1);
});
it('uses saved notification preferences without losing original activity', () => {
  expect(
    visibleChatActivity(value, [], {
      ...prefs,
      notifications: { ...prefs.notifications, messages: false, joinRequests: false },
    }),
  ).toEqual({ groups: [], total_unread: 0, pending_requests: 0 });
  expect(visibleChatActivity(value, [], prefs).total_unread).toBe(9);
});
