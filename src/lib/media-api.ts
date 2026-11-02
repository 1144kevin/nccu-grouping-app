import { api } from '@/lib/api';
import type { CorePost, CorePostInput } from '@/lib/core-api';

export type ImageAsset = { id: string; width: number; height: number; state: 'pending' | 'ready' };
export type DraftImage = ImageAsset & { created_at: string };
export type ImageLink = {
  id: string;
  url: string;
  expires_in: number;
  width: number;
  height: number;
};
export const mediaApi = {
  edit: async (
    postId: string,
    value: CorePostInput,
    image_ids: string[],
    expected_version: number,
  ) =>
    (
      await api.put<CorePost>(
        `/uploads/posts/${encodeURIComponent(postId)}`,
        { value, image_ids, expected_version },
        { timeout: 60_000 },
      )
    ).data,
  content: async (id: string) =>
    (
      await api.get<{ content_base64: string; width: number; height: number }>(
        `/uploads/images/${encodeURIComponent(id)}/content`,
      )
    ).data,
  upload: async (content_base64: string, key: string) =>
    (
      await api.post<ImageAsset>(
        '/uploads/images',
        { content_base64 },
        { headers: { 'Idempotency-Key': key }, timeout: 60_000 },
      )
    ).data,
  publish: async (value: CorePostInput, image_id: string | string[], key: string) =>
    (
      await api.post<CorePost>(
        '/uploads/publish',
        { value, ...(Array.isArray(image_id) ? { image_ids: image_id } : { image_id }) },
        { headers: { 'Idempotency-Key': key } },
      )
    ).data,
  link: async (id: string) =>
    (await api.get<ImageLink>(`/uploads/images/${encodeURIComponent(id)}`)).data,
  drafts: async () => (await api.get<{ items: DraftImage[] }>('/uploads/images')).data,
  remove: async (id: string) =>
    (await api.delete<{ deleted: true }>(`/uploads/images/${encodeURIComponent(id)}`)).data,
};

export function validPickedImage(
  base64: string | undefined | null,
  width: number,
  height: number,
): string {
  if (!base64 || base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64))
    throw new Error('invalid_image_input');
  if (base64.length > 5_592_408) throw new Error('image_too_large');
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1 ||
    width * height > 16_000_000
  )
    throw new Error('image_dimensions_too_large');
  return base64;
}

export function trustedImageLink(value: string): string {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'axdwbfhrkbovgrbngrrh.supabase.co' ||
    url.port ||
    url.username ||
    url.password ||
    url.hash ||
    !/^\/storage\/v1\/object\/sign\/core-post-images\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/.test(
      url.pathname,
    ) ||
    url.searchParams.getAll('token').length !== 1 ||
    !url.searchParams.get('token')
  )
    throw new Error('image_storage_unavailable');
  return value;
}
