import { api } from '@/lib/api';
import type { ImageAsset } from '@/lib/media-api';
export type Likes = { likes: number; liked: boolean };
export type ProfileImage = { content_base64: string; width: number; height: number };
export const profileSocial = {
  likes: async (id: string) =>
    (await api.get<Likes>(`/users/${encodeURIComponent(id)}/likes`)).data,
  like: async (id: string, liked: boolean) =>
    (await api.put<Likes>(`/users/${encodeURIComponent(id)}/likes`, { liked })).data,
  avatar: async (id: string) =>
    (await api.get<ProfileImage | null>(`/users/${encodeURIComponent(id)}/avatar`)).data,
  image: async (id: string) =>
    (await api.get<ProfileImage>(`/profile-images/${encodeURIComponent(id)}`)).data,
  upload: async (purpose: 'avatar' | 'evidence', content_base64: string, key: string) =>
    (
      await api.post<ImageAsset>(
        `/profile-images/${purpose}`,
        { content_base64 },
        { headers: { 'Idempotency-Key': key }, timeout: 60_000 },
      )
    ).data,
};
