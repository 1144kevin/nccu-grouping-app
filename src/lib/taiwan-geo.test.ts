import { describe, expect, it } from '@jest/globals';
import { TAIWAN_COUNTIES, filterPostsByPreferredRegions, inferTaiwanCounty } from './taiwan-geo';

describe('taiwan-geo', () => {
  it('lists all 22 counties in Taiwan', () => {
    expect(TAIWAN_COUNTIES).toHaveLength(22);
  });

  it('infers counties from real GPS coordinates', () => {
    expect(inferTaiwanCounty(24.9875, 121.576)).toBe('臺北市');
    expect(inferTaiwanCounty(25.0143, 121.4636)).toBe('新北市');
    expect(inferTaiwanCounty(24.9537, 121.2256)).toBe('桃園市');
    expect(inferTaiwanCounty(24.8039, 120.9647)).toBe('新竹市');
    expect(inferTaiwanCounty(24.8397, 121.011)).toBe('新竹縣');
    expect(inferTaiwanCounty(24.1788, 120.6467)).toBe('臺中市');
    expect(inferTaiwanCounty(22.9997, 120.227)).toBe('臺南市');
    expect(inferTaiwanCounty(22.666, 120.3025)).toBe('高雄市');
    expect(inferTaiwanCounty(23.5711, 119.5793)).toBe('澎湖縣');
  });

  it('filters posts by actual coordinates rather than location name', () => {
    const taipei = { id: '1', location: { name: '台中逢甲分店', latitude: 25.033, longitude: 121.5654 } };
    const taichung = { id: '2', location: { name: '台北車站店', latitude: 24.1788, longitude: 120.6467 } };
    expect(filterPostsByPreferredRegions([taipei, taichung], ['臺北市'])).toEqual([taipei]);
    expect(filterPostsByPreferredRegions([taipei, taichung], ['臺中市'])).toEqual([taichung]);
    expect(filterPostsByPreferredRegions([taipei, taichung], [])).toEqual([taipei, taichung]);
  });
});
