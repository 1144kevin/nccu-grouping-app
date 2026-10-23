import { api } from '@/lib/api';
import type { ImageAsset } from '@/lib/media-api';

export type PhotoChatKind = 'group' | 'direct' | 'stealth';
export type SentPhoto = { id: string; image_id: string; local_uri: string; created_at: string };
export const chatPhotos = {
  upload: async (content_base64: string, key: string) =>
    (
      await api.post<ImageAsset>(
        '/chat-photos/uploads',
        { content_base64 },
        { headers: { 'Idempotency-Key': key }, timeout: 60_000 },
      )
    ).data,
  send: async (kind: PhotoChatKind, thread_id: string, image_id: string, key: string) =>
    (
      await api.post(
        '/chat-photos',
        { kind, thread_id, image_id },
        { headers: { 'Idempotency-Key': key } },
      )
    ).data,
  read: async (id: string) =>
    (
      await api.get<{ content_base64: string; width: number; height: number }>(
        `/chat-photos/${encodeURIComponent(id)}`,
      )
    ).data,
  remove: async (id: string) => (await api.delete(`/chat-photos/${encodeURIComponent(id)}`)).data,
};
