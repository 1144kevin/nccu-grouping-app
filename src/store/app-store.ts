import { create } from 'zustand';
import {
  initialConversations,
  initialHistory,
  initialNotifications,
  initialPosts,
  initialRequests,
} from '@/data/demo';
import type {
  AppNotification,
  Conversation,
  CreatePostInput,
  FeedPost,
  JoinStatus,
  NotificationSettings,
  OrderHistory,
  UserProfile,
} from '@/types/domain';

type AppState = {
  posts: FeedPost[];
  interestedPostIds: string[];
  dismissedPostIds: string[];
  requests: typeof initialRequests;
  conversations: Conversation[];
  history: OrderHistory[];
  notifications: AppNotification[];
  reminderPostIds: string[];
  mutedConversationIds: string[];
  blockedUserNames: string[];
  preferredTags: string[];
  notificationSettings: NotificationSettings;
  currentUser: UserProfile;
  toggleInterest: (postId: string) => void;
  dismissPost: (postId: string) => void;
  updateRequest: (requestId: string, status: JoinStatus) => void;
  markRead: (conversationId: string) => void;
  sendMessage: (conversationId: string, text: string) => void;
  startConversation: (name: string, badge: string, level: number) => string;
  toggleReminder: (postId: string) => void;
  toggleConversationMuted: (conversationId: string) => void;
  toggleBlockedUser: (name: string) => void;
  togglePreferredTag: (tag: string) => void;
  updateNotificationSetting: (key: keyof NotificationSettings, value: boolean) => void;
  markNotificationRead: (notificationId: string) => void;
  markAllNotificationsRead: () => void;
  updateProfile: (profile: Pick<UserProfile, 'name' | 'badge' | 'bio'>) => void;
  publishPost: (input: CreatePostInput) => FeedPost;
};

export const useAppStore = create<AppState>((set, get) => ({
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
  toggleInterest: (postId) =>
    set((state) => ({
      interestedPostIds: state.interestedPostIds.includes(postId)
        ? state.interestedPostIds.filter((id) => id !== postId)
        : [...state.interestedPostIds, postId],
    })),
  dismissPost: (postId) =>
    set((state) => ({ dismissedPostIds: [...new Set([...state.dismissedPostIds, postId])] })),
  updateRequest: (requestId, status) =>
    set((state) => ({
      requests: state.requests.map((request) =>
        request.id === requestId ? { ...request, status } : request,
      ),
    })),
  markRead: (conversationId) =>
    set((state) => ({
      conversations: state.conversations.map((conversation) =>
        conversation.id === conversationId ? { ...conversation, unread: false } : conversation,
      ),
    })),
  sendMessage: (conversationId, text) =>
    set((state) => ({
      conversations: state.conversations.map((conversation) =>
        conversation.id === conversationId
          ? {
              ...conversation,
              preview: text,
              time: '現在',
              unread: false,
              messages: [
                ...conversation.messages,
                { id: `m-${Date.now()}`, text, mine: true, sentAt: '現在' },
              ],
            }
          : conversation,
      ),
    })),
  startConversation: (name, badge, level) => {
    const existing = get().conversations.find((item) => item.name === name);
    if (existing) return existing.id;
    const id = `c-${Date.now()}`;
    set((state) => ({
      conversations: [
        {
          id,
          name,
          badge,
          level,
          preview: '開始一段新的對話',
          time: '現在',
          inbox: 'general',
          unread: false,
          messages: [],
        },
        ...state.conversations,
      ],
    }));
    return id;
  },
  toggleReminder: (postId) =>
    set((state) => ({
      reminderPostIds: state.reminderPostIds.includes(postId)
        ? state.reminderPostIds.filter((id) => id !== postId)
        : [...state.reminderPostIds, postId],
    })),
  toggleConversationMuted: (conversationId) =>
    set((state) => ({
      mutedConversationIds: state.mutedConversationIds.includes(conversationId)
        ? state.mutedConversationIds.filter((id) => id !== conversationId)
        : [...state.mutedConversationIds, conversationId],
    })),
  toggleBlockedUser: (name) =>
    set((state) => ({
      blockedUserNames: state.blockedUserNames.includes(name)
        ? state.blockedUserNames.filter((item) => item !== name)
        : [...state.blockedUserNames, name],
    })),
  togglePreferredTag: (tag) =>
    set((state) => ({
      preferredTags: state.preferredTags.includes(tag)
        ? state.preferredTags.filter((item) => item !== tag)
        : [...state.preferredTags, tag],
    })),
  updateNotificationSetting: (key, value) =>
    set((state) => ({ notificationSettings: { ...state.notificationSettings, [key]: value } })),
  markNotificationRead: (notificationId) =>
    set((state) => ({
      notifications: state.notifications.map((item) =>
        item.id === notificationId ? { ...item, read: true } : item,
      ),
    })),
  markAllNotificationsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((item) => ({ ...item, read: true })),
    })),
  updateProfile: (profile) =>
    set((state) => ({ currentUser: { ...state.currentUser, ...profile } })),
  publishPost: (input) => {
    const currentUser = get().currentUser;
    const post: FeedPost = {
      id: `mine-${Date.now()}`,
      name: currentUser.name,
      badge: currentUser.badge,
      level: 5,
      time: '剛剛',
      content: input.content,
      tags: input.tags,
      deadline: input.deadline,
      joined: 1,
      capacity: input.capacity,
      imageUrl: input.imageUrl,
      isMine: true,
    };
    set((state) => ({
      posts: [post, ...state.posts],
      history: [
        {
          id: `h-${Date.now()}`,
          title: input.content,
          detail: `${input.deadline} · 1/${input.capacity} 人`,
          status: '進行中',
          emoji: input.voiceUri ? '🎙️' : input.imageUrl ? '📷' : '🍱',
        },
        ...state.history,
      ],
    }));
    return post;
  },
}));

export const selectUnreadCount = (state: AppState) =>
  state.conversations.filter((item) => item.unread).length;
export const selectPendingCount = (state: AppState) =>
  state.requests.filter((item) => item.status === 'pending').length;
export const selectUnreadNotificationCount = (state: AppState) =>
  state.notifications.filter((item) => !item.read).length;
