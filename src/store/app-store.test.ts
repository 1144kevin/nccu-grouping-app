import {
  initialConversations,
  initialHistory,
  initialNotifications,
  initialPosts,
  initialRequests,
} from '@/data/demo';
import { useAppStore } from '@/store/app-store';
import { beforeEach, describe, expect, it } from '@jest/globals';

const initialState = {
  posts: initialPosts,
  interestedPostIds: ['pizza'],
  dismissedPostIds: [],
  requests: initialRequests,
  conversations: initialConversations,
  history: initialHistory,
  notifications: initialNotifications,
  reminderPostIds: [],
  mutedConversationIds: [],
  blockedUserNames: [],
  preferredTags: ['甜點', '飲料', '宵夜'],
  notificationSettings: {
    joinRequests: true,
    messages: true,
    recommendations: true,
    deadlineReminders: true,
  },
  currentUser: {
    name: 'Kevin',
    badge: '🍜',
    bio: '喜歡揪大家一起訂校園附近的餐點。',
    joinedAt: '2026年5月',
  },
};

beforeEach(() => {
  useAppStore.setState(initialState);
});

describe('app store workflows', () => {
  it('toggles interest without affecting other posts', () => {
    useAppStore.getState().toggleInterest('croissant');
    expect(useAppStore.getState().interestedPostIds).toEqual(['pizza', 'croissant']);

    useAppStore.getState().toggleInterest('pizza');
    expect(useAppStore.getState().interestedPostIds).toEqual(['croissant']);
  });

  it('accepts a join request', () => {
    useAppStore.getState().updateRequest('r1', 'accepted');
    expect(useAppStore.getState().requests.find((item) => item.id === 'r1')?.status).toBe(
      'accepted',
    );
  });

  it('publishes a post to the feed and history', () => {
    const post = useAppStore.getState().publishPost({
      content: '今天晚上六點想揪三個人一起訂晚餐。',
      tags: ['拼單'],
      deadline: '今天 17:30',
      capacity: 4,
    });

    expect(useAppStore.getState().posts[0].id).toBe(post.id);
    expect(useAppStore.getState().history[0].status).toBe('進行中');
  });

  it('sends a message and marks the conversation as read', () => {
    useAppStore.getState().sendMessage('c1', '我可以在校門口取餐');
    const conversation = useAppStore.getState().conversations.find((item) => item.id === 'c1');

    expect(conversation?.preview).toBe('我可以在校門口取餐');
    expect(conversation?.unread).toBe(false);
    expect(conversation?.messages.at(-1)?.mine).toBe(true);
  });

  it('creates or reuses a conversation', () => {
    const firstId = useAppStore.getState().startConversation('new_user', '🥐', 2);
    const secondId = useAppStore.getState().startConversation('new_user', '🥐', 2);

    expect(firstId).toBe(secondId);
    expect(
      useAppStore.getState().conversations.filter((item) => item.name === 'new_user'),
    ).toHaveLength(1);
  });

  it('updates reminder, mute, block and preference state', () => {
    const store = useAppStore.getState();
    store.toggleReminder('croissant');
    store.toggleConversationMuted('c1');
    store.toggleBlockedUser('pizza_boy');
    store.togglePreferredTag('早餐');

    const state = useAppStore.getState();
    expect(state.reminderPostIds).toContain('croissant');
    expect(state.mutedConversationIds).toContain('c1');
    expect(state.blockedUserNames).toContain('pizza_boy');
    expect(state.preferredTags).toContain('早餐');
  });

  it('updates profile and notification settings', () => {
    useAppStore.getState().updateProfile({ name: 'Kevin Liang', badge: '🥐', bio: '早餐團主揪' });
    useAppStore.getState().updateNotificationSetting('recommendations', false);
    useAppStore.getState().markAllNotificationsRead();

    expect(useAppStore.getState().currentUser.name).toBe('Kevin Liang');
    expect(useAppStore.getState().notificationSettings.recommendations).toBe(false);
    expect(useAppStore.getState().notifications.every((item) => item.read)).toBe(true);
  });
});
