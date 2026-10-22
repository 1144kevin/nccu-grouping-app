import { distanceKm, postLocationSchema } from './location';
import type { PostLocation } from '@/types/domain';

export type PickupFavorite = { id: string; location: PostLocation };
export type FavoritesIO = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  remove: (key: string) => Promise<void>;
};
const LIMIT = 20;
// One bounded record per key keeps native SecureStore values small.
export function createPickupFavorites(io: FavoritesIO) {
  let queue: Promise<unknown> = Promise.resolve();
  function exclusive<T>(work: () => Promise<T>) {
    const result = queue.then(work, work);
    queue = result.catch(() => undefined);
    return result;
  }
  function prefix(owner: string) {
    if (!/^[a-zA-Z0-9._-]{1,100}$/.test(owner)) throw new Error('invalid_favorite_owner');
    return `nccu.pickup.${owner}`;
  }
  async function ids(owner: string): Promise<string[]> {
    const raw = await io.get(prefix(owner) + '.index');
    if (!raw) return [];
    const value = JSON.parse(raw);
    if (!Array.isArray(value) || value.length > LIMIT ||
      !value.every((v) => typeof v === 'string' && /^[a-z0-9-]{1,80}$/.test(v))) {
      throw new Error('invalid_favorite_index');
    }
    return [...new Set(value)];
  }
  async function load(owner: string): Promise<PickupFavorite[]> {
    const result: PickupFavorite[] = [];
    for (const id of await ids(owner)) {
      const raw = await io.get(`${prefix(owner)}.${id}`);
      if (!raw) continue;
      try {
        const parsed = postLocationSchema.safeParse(JSON.parse(raw));
        if (parsed.success) result.push({ id, location: parsed.data });
      } catch { /* Skip damaged records without exposing another account's entries. */ }
    }
    return result;
  }
  return {
    list: (owner: string) => exclusive(() => load(owner)),
    add: (owner: string, value: PostLocation) => exclusive(async () => {
      const location = postLocationSchema.parse(value);
      const current = await load(owner);
      if (current.some((item) => distanceKm(item.location, location) < 0.005)) return current;
      if (current.length >= LIMIT) throw new Error('favorite_limit');
      const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      const key = `${prefix(owner)}.${id}`;
      await io.set(key, JSON.stringify(location));
      try {
        await io.set(prefix(owner) + '.index', JSON.stringify([...current.map((v) => v.id), id]));
      } catch (error) {
        await io.remove(key).catch(() => undefined);
        throw error;
      }
      return [...current, { id, location }];
    }),
    remove: (owner: string, id: string) => exclusive(async () => {
      const current = await load(owner);
      const remaining = current.filter((v) => v.id !== id);
      await io.set(prefix(owner) + '.index', JSON.stringify(remaining.map((v) => v.id)));
      if (current.some((v) => v.id === id)) await io.remove(`${prefix(owner)}.${id}`);
      return remaining;
    }),
  };
}
