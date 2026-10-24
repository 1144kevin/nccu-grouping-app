import { api } from '@/lib/api';

export const SHARE_TOKEN = /^[0-9a-f]{64}$/;
export type SharedPost = {
  id: string;
  author_name: string;
  author_badge: string;
  author_level: number;
  content: string;
  tags: string[];
  created_at: string;
  deadline_at: string;
  capacity: number;
  joined: number;
  status: 'open' | 'full' | 'expired';
  price_per_person: string | null;
  location_name: string;
  images: { id: string; width: number; height: number }[];
};

export function publicPostURL(token: string): string {
  if (!SHARE_TOKEN.test(token)) throw new Error('invalid_share_link');
  const origin =
    typeof window !== 'undefined' ? window.location.origin : process.env.EXPO_PUBLIC_SHARE_ORIGIN;
  if (!origin) throw new Error('share_origin_unavailable');
  const url = new URL(origin);
  if (
    url.protocol !== 'https:' &&
    !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))
  )
    throw new Error('share_origin_unavailable');
  return `${url.origin}/s/${token}`;
}

export const postSharingApi = {
  create: async (postId: string) => {
    const { data } = await api.post<{ token: string }>(
      `/posts/${encodeURIComponent(postId)}/share`,
    );
    return publicPostURL(data.token);
  },
  read: async (token: string) => (await api.get<SharedPost>(`/public/posts/${token}`)).data,
};

export function sharedImageURL(token: string, imageId: string): string {
  if (!SHARE_TOKEN.test(token) || !/^[0-9a-f-]{36}$/.test(imageId))
    throw new Error('invalid_share_link');
  return `${api.defaults.baseURL?.replace(/\/$/, '') ?? '/api/v1'}/public/posts/${token}/images/${imageId}`;
}
