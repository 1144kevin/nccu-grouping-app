import { describe, expect, it } from '@jest/globals';
import { distanceKm, formatDistance, googleMapsUrl, parseLocationInput, postLocationSchema } from './location';

describe('post locations', () => {
  it('accepts valid coordinates including zero and rejects invalid ranges', () => {
    expect(parseLocationInput(' 0, -180 ')).toEqual({ latitude: 0, longitude: -180 });
    expect(parseLocationInput('24.98,121.575')).toEqual({ latitude: 24.98, longitude: 121.575 });
    for (const value of ['91, 0', '0, 181', 'NaN, 0', '', '台北市']) expect(parseLocationInput(value)).toBeUndefined();
  });
  it('uses place coordinates instead of the map camera and accepts Maps search URLs', () => {
    expect(parseLocationInput('https://www.google.com/maps/place/test/@25,122,16z/data=!4m2!3d24.98!4d121.575')).toEqual({ latitude: 24.98, longitude: 121.575 });
    expect(parseLocationInput(googleMapsUrl({ latitude: 0, longitude: 0 }))).toEqual({ latitude: 0, longitude: 0 });
    expect(parseLocationInput('https://maps.google.com/?q=24.98,121.575')).toEqual({ latitude: 24.98, longitude: 121.575 });
  });
  it('rejects ambiguous links, shortened links and non-Google URLs', () => {
    for (const value of ['https://www.google.com/maps/@25,121,16z', 'https://maps.app.goo.gl/example', 'https://evil.example/maps?q=25,121', 'javascript:alert(1)', 'https://www.google.com/maps?query=台北']) expect(parseLocationInput(value)).toBeUndefined();
  });
  it('requires a name and finite coordinates before publishing', () => {
    expect(postLocationSchema.safeParse(undefined).success).toBe(false);
    expect(postLocationSchema.safeParse({ name: ' ', latitude: 25, longitude: 121 }).success).toBe(false);
    expect(postLocationSchema.safeParse({ name: '測試', latitude: NaN, longitude: 121 }).success).toBe(false);
  });
  it('calculates straight-line kilometers, including across the date line', () => {
    expect(distanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0 })).toBe(0);
    expect(distanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 })).toBeCloseTo(111.195, 2);
    expect(distanceKm({ latitude: 0, longitude: 179.9 }, { latitude: 0, longitude: -179.9 })).toBeCloseTo(22.239, 2);
    expect(formatDistance(0.04)).toBe('距離你不到 0.1 公里');
    expect(formatDistance(2.36)).toBe('距離你約 2.4 公里');
  });
});
