export type JoinStatus = 'pending' | 'accepted' | 'rejected';
export type InboxType = 'primary' | 'general';

export type Coordinates = { latitude: number; longitude: number };
export type PostLocation = Coordinates & { name: string; address?: string; source?: 'openstreetmap' };

export type FeedPost = {
  id: string;
  name: string;
  badge: string;
  level: number;
  time: string;
  content: string;
  tags: string[];
  deadline: string;
  deadlineAt?: string;
  joined: number;
  capacity: number;
  imageUrl?: string;
  isMine?: boolean;
  location?: PostLocation;
  pricePerPerson?: number;
};

export type JoinRequest = {
  id: string;
  postId: string;
  postTitle: string;
  name: string;
  badge: string;
  level: number;
  requestedAt: string;
  status: JoinStatus;
};

export type ChatMessage = {
  id: string;
  text: string;
  mine: boolean;
  sentAt: string;
};

export type Conversation = {
  pinned?: boolean;
  id: string;
  name: string;
  badge: string;
  level: number;
  preview: string;
  time: string;
  inbox: InboxType;
  unread: boolean;
  messages: ChatMessage[];
};

export type OrderHistory = {
  id: string;
  title: string;
  detail: string;
  status: '進行中' | '已完成' | '已截止';
  emoji: string;
};

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  time: string;
  icon: string;
  read: boolean;
  target: string;
};

export type NotificationSettings = {
  joinRequests: boolean;
  messages: boolean;
  recommendations: boolean;
  deadlineReminders: boolean;
};

export type UserProfile = {
  name: string;
  badge: string;
  bio: string;
  joinedAt: string;
};

export type CreatePostInput = {
  pricePerPerson?: number;
  location: PostLocation;
  content: string;
  tags: string[];
  deadline: string;
  capacity: number;
  imageUrl?: string;
  voiceUri?: string;
};
