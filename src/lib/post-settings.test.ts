import { describe, expect, it } from '@jest/globals';
import { capacityInputSchema } from './capacity';
import { formatPrice, parsePrice, priceInputSchema } from './price';
import { parsePlaceResults } from './place-search';

describe('post settings', () => {
  it('accepts manually entered positive headcounts without the former cap', () => {
    for (const value of ['1', '20', '100', '10000']) expect(capacityInputSchema.safeParse(value).success).toBe(true);
    for (const value of ['', '0', '-2', '1.5', 'abc', '1e3']) expect(capacityInputSchema.safeParse(value).success).toBe(false);
  });
  it('distinguishes an unspecified price from free and validates currency input', () => {
    expect(parsePrice('')).toBeUndefined();
    expect(parsePrice('0')).toBe(0);
    expect(parsePrice('85.50')).toBe(85.5);
    expect(formatPrice()).toBe('待確認');
    expect(formatPrice(0)).toBe('免費');
    expect(formatPrice(85.5)).toBe('NT$ 85.5／人');
    for (const value of ['-1', 'abc', '1.234', '1000000', 'Infinity']) expect(priceInputSchema.safeParse(value).success).toBe(false);
  });
  it('converts GeoJSON longitude/latitude correctly and keeps address attribution', () => {
    const feature = { geometry: { type: 'Point', coordinates: [121.575, 24.98] }, properties: { name: '國立政治大學', city: '臺北市', district: '文山區', street: '指南路', housenumber: '64' } };
    const results = parsePlaceResults({ features: [feature, feature, { ...feature, geometry: { type: 'Point', coordinates: [999, 999] } }] });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ name: '國立政治大學', latitude: 24.98, longitude: 121.575, address: '臺北市 文山區 指南路 64', source: 'openstreetmap' });
    expect(parsePlaceResults({ features: [] })).toEqual([]);
    expect(() => parsePlaceResults({ error: 'unavailable' })).toThrow();
  });
});
