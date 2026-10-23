import { describe, expect, it } from '@jest/globals';
import { googleMapsDirectionsUrl } from './location';
import { createPickupFavorites } from './pickup-favorites';
import { pickupAddress, splitPickupAddress } from './pickup-details';
import { buildPickupMap, readMapMessage } from './pickup-map';
import { campusPickupPlaces } from '@/data/campus-pickup-places';

const point = { name: '自訂桌子', latitude: 24.986, longitude: 121.576, address: '取餐說明：右側' };
function store() {
  const values = new Map<string, string>();
  return {
    values,
    io: {
      get: async (key: string) => values.get(key) ?? null,
      set: async (key: string, v: string) => {
        values.set(key, v);
      },
      remove: async (key: string) => {
        values.delete(key);
      },
    },
  };
}
describe('pickup locations', () => {
  it('offers three direct campus shortcuts with distinct coordinates', () => {
    expect(campusPickupPlaces.map((p) => p.name)).toEqual(['正門', '莊九', '麥側']);
    expect(new Set(campusPickupPlaces.map((p) => `${p.latitude},${p.longitude}`)).size).toBe(3);
  });
  it('routes to the exact selected coordinates without sending the viewer origin', () => {
    const url = new URL(googleMapsDirectionsUrl(point));
    expect(url.searchParams.get('destination')).toBe('24.986,121.576');
    expect(url.searchParams.get('travelmode')).toBe('walking');
    expect(url.searchParams.has('origin')).toBe(false);
    expect(url.searchParams.has('key')).toBe(false);
  });
  it('round-trips original addresses and notes in the existing server field, including old records', () => {
    const address = pickupAddress('原始街道地址', '一樓桌子');
    expect(splitPickupAddress(address)).toEqual({ address: '原始街道地址', note: '一樓桌子' });
    expect(splitPickupAddress('舊版地址')).toEqual({ address: '舊版地址', note: '' });
    expect(splitPickupAddress(null)).toEqual({ address: '', note: '' });
    expect(() => pickupAddress('a'.repeat(490), 'b'.repeat(100))).toThrow();
  });
  it('rejects forged map messages, invalid coordinates and script text', () => {
    expect(
      readMapMessage({ type: 'pickup-map', channel: 'a', latitude: 0, longitude: 0 }, 'a'),
    ).toEqual({ latitude: 0, longitude: 0 });
    for (const raw of [
      { type: 'pickup-map', channel: 'b', ...point },
      { type: 'wrong', channel: 'a', ...point },
      { type: 'pickup-map', channel: 'a', latitude: 91, longitude: 0 },
      { type: 'pickup-map', channel: 'a', latitude: '25', longitude: 121 },
      { type: 'pickup-map', channel: 'a', latitude: NaN, longitude: 121 },
      'invalid json',
    ])
      expect(readMapMessage(raw, 'a')).toBeUndefined();
    const html = buildPickupMap(point, '</script><script>alert(1)</script>');
    expect(html).not.toContain('channel":"</script>');
    expect(html).not.toContain('https://unpkg.com');
    expect(html).toContain('keepBuffer:0');
    expect(html).toContain('OpenStreetMap contributors');
  });
  it('persists per-account favorites across reloads and deduplicates coordinates', async () => {
    const { io } = store();
    const first = createPickupFavorites(io);
    await first.add('alice', point);
    await first.add('alice', { ...point, name: '相同位置另一個名字' });
    expect(await createPickupFavorites(io).list('alice')).toHaveLength(1);
    expect(await first.list('bob')).toEqual([]);
    await first.add('bob', { ...point, name: '另一人' });
    const [favorite] = await first.list('alice');
    await first.remove('alice', favorite.id);
    expect(await first.list('alice')).toEqual([]);
    expect(await first.list('bob')).toHaveLength(1);
  });
  it('serializes concurrent saves and enforces the twenty-place limit', async () => {
    const { io } = store();
    const favorites = createPickupFavorites(io);
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        favorites.add('alice', { ...point, latitude: 24 + i / 100 }),
      ),
    );
    expect(await favorites.list('alice')).toHaveLength(20);
    await expect(favorites.add('alice', { ...point, latitude: 26 })).rejects.toThrow(
      'favorite_limit',
    );
  });
  it('reports storage failures without falsely succeeding or corrupting another account', async () => {
    const { io } = store();
    const failing = createPickupFavorites({
      ...io,
      set: async () => {
        throw new Error('quota');
      },
    });
    await expect(failing.add('alice', point)).rejects.toThrow('quota');
    expect(await createPickupFavorites(io).list('alice')).toEqual([]);
    await expect(failing.list('../bob')).rejects.toThrow();
  });
});
