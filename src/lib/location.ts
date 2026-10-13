import { z } from 'zod';
import type { Coordinates } from '@/types/domain';

export const postLocationSchema = z.object({
  name: z.string().trim().min(1, '請輸入取餐地點名稱').max(100),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  address: z.string().max(500).optional(),
  source: z.literal('openstreetmap').optional(),
});

function coordinatePair(value: string): Coordinates | undefined {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return;
  return { latitude, longitude };
}

// Map camera coordinates (@lat,lng) may differ from the selected place; never use them.
export function parseLocationInput(value: string): Coordinates | undefined {
  const coordinates = coordinatePair(value);
  if (coordinates) return coordinates;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || !/^(www\.|maps\.)?google\.(com|com\.tw)$/.test(url.hostname)) return;
    if (!url.pathname.startsWith('/maps') && url.hostname !== 'maps.google.com') return;
    const data = decodeURIComponent(url.pathname + url.search);
    const place = data.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
    if (place) return coordinatePair(`${place[1]},${place[2]}`);
    return coordinatePair(url.searchParams.get('query') ?? url.searchParams.get('q') ?? '');
  } catch {
    return;
  }
}

export function googleMapsUrl(location: Coordinates): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${location.latitude},${location.longitude}`)}`;
}

export function distanceKm(from: Coordinates, to: Coordinates): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const a = Math.sin(radians(to.latitude - from.latitude) / 2) ** 2
    + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude))
    * Math.sin(radians(to.longitude - from.longitude) / 2) ** 2;
  return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
}

export function formatDistance(km: number): string {
  return km < 0.1 ? '距離你不到 0.1 公里' : `距離你約 ${km.toFixed(1)} 公里`;
}
