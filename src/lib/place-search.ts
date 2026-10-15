import { z } from 'zod';
import type { PostLocation } from '@/types/domain';

export type PlaceResult = PostLocation & { id: string; address: string; source: 'openstreetmap' };
const featureSchema = z.object({
  geometry: z.object({ type: z.literal('Point'), coordinates: z.tuple([z.number().finite().min(-180).max(180), z.number().finite().min(-90).max(90)]) }),
  properties: z.object({ name: z.string().optional(), street: z.string().optional(), housenumber: z.string().optional(), district: z.string().optional(), city: z.string().optional(), county: z.string().optional(), state: z.string().optional(), country: z.string().optional() }),
});

export function parsePlaceResults(data: unknown): PlaceResult[] {
  const envelope = z.object({ features: z.array(z.unknown()) }).parse(data);
  const results = new Map<string, PlaceResult>();
  for (const feature of envelope.features) {
    const parsed = featureSchema.safeParse(feature);
    if (!parsed.success) continue;
    const { geometry, properties: p } = parsed.data;
    const [longitude, latitude] = geometry.coordinates;
    const address = [...new Set([p.state, p.county, p.city, p.district, p.street, p.housenumber].filter(Boolean))].join(' ');
    const name = (p.name || address).trim().slice(0, 100);
    if (!name) continue;
    const id = `${latitude},${longitude},${name}`;
    results.set(id, { id, name, address: address || p.country || name, latitude, longitude, source: 'openstreetmap' });
  }
  return [...results.values()].slice(0, 5);
}

const cache = new Map<string, PlaceResult[]>();
const pending = new Map<string, Promise<PlaceResult[]>>();
let queue = Promise.resolve();
let lastRequest = 0;

// Search only on explicit submission. Cache and serialize to keep demo-service use modest.
export function searchPlaces(input: string): Promise<PlaceResult[]> {
  const query = input.trim();
  if (query.length < 2) return Promise.resolve([]);
  const cached = cache.get(query);
  if (cached) return Promise.resolve(cached);
  const existing = pending.get(query);
  if (existing) return existing;
  const request = queue.then(async () => {
    const delay = 1100 - (Date.now() - lastRequest);
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    lastRequest = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const endpoint = process.env.EXPO_PUBLIC_GEOCODER_URL || 'https://photon.komoot.io/api/';
      const params = new URLSearchParams({ q: query, limit: '5', lat: '24.98', lon: '121.575' });
      const response = await fetch(`${endpoint}?${params}`, { signal: controller.signal, headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('地點搜尋暫時無法使用，請稍後再試。');
      const results = parsePlaceResults(await response.json());
      if (cache.size >= 30) cache.delete(cache.keys().next().value!);
      cache.set(query, results);
      return results;
    } finally { clearTimeout(timer); }
  });
  pending.set(query, request);
  queue = request.then(() => { pending.delete(query); }, () => { pending.delete(query); });
  return request;
}
