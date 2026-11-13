export const TAIWAN_COUNTIES = [
  '臺北市',
  '新北市',
  '基隆市',
  '桃園市',
  '新竹市',
  '新竹縣',
  '苗栗縣',
  '臺中市',
  '彰化縣',
  '南投縣',
  '雲林縣',
  '嘉義市',
  '嘉義縣',
  '臺南市',
  '高雄市',
  '屏東縣',
  '宜蘭縣',
  '花蓮縣',
  '臺東縣',
  '澎湖縣',
  '金門縣',
  '連江縣',
] as const;

export const TAIWAN_COUNTY_SET = new Set<string>(TAIWAN_COUNTIES);

const COUNTY_ANCHORS: Record<string, readonly [number, number][]> = {
  臺北市: [
    [25.0478, 121.517],
    [25.033, 121.5654],
    [25.08, 121.56],
    [25.136, 121.506],
    [24.9875, 121.576],
    [25.055, 121.607],
  ],
  新北市: [
    [25.0143, 121.4636],
    [25.041, 121.45],
    [25.062, 121.487],
    [24.999, 121.495],
    [24.968, 121.541],
    [25.172, 121.443],
    [25.068, 121.662],
    [25.109, 121.811],
    [24.936, 121.373],
  ],
  基隆市: [
    [25.1283, 121.7419],
    [25.15, 121.77],
  ],
  桃園市: [
    [24.9936, 121.301],
    [24.9537, 121.2256],
    [25.056, 121.213],
    [24.864, 121.213],
    [24.805, 121.351],
  ],
  新竹市: [
    [24.8039, 120.9647],
    [24.79, 120.99],
  ],
  新竹縣: [
    [24.8397, 121.011],
    [24.739, 121.087],
    [24.675, 121.215],
  ],
  苗栗縣: [
    [24.5602, 120.8214],
    [24.687, 120.903],
    [24.439, 120.654],
  ],
  臺中市: [
    [24.1477, 120.6736],
    [24.1788, 120.6467],
    [24.253, 120.719],
    [24.265, 120.573],
    [24.095, 120.692],
    [24.255, 121.245],
  ],
  彰化縣: [
    [24.0757, 120.543],
    [23.959, 120.571],
    [24.054, 120.431],
  ],
  南投縣: [
    [23.9157, 120.684],
    [23.966, 120.967],
    [23.757, 120.683],
  ],
  雲林縣: [
    [23.7092, 120.543],
    [23.708, 120.431],
    [23.57, 120.304],
  ],
  嘉義市: [[23.4801, 120.4491]],
  嘉義縣: [
    [23.4589, 120.2929],
    [23.556, 120.43],
    [23.51, 120.803],
  ],
  臺南市: [
    [22.9997, 120.227],
    [23.025, 120.217],
    [23.31, 120.316],
    [23.18, 120.246],
  ],
  高雄市: [
    [22.6273, 120.3014],
    [22.666, 120.3025],
    [22.73, 120.332],
    [22.626, 120.358],
    [22.794, 120.296],
    [22.889, 120.481],
  ],
  屏東縣: [
    [22.669, 120.486],
    [22.551, 120.548],
    [22.466, 120.448],
    [22.003, 120.744],
  ],
  宜蘭縣: [
    [24.757, 121.753],
    [24.677, 121.767],
    [24.594, 121.852],
  ],
  花蓮縣: [
    [23.9769, 121.6044],
    [23.753, 121.451],
    [23.332, 121.317],
  ],
  臺東縣: [
    [22.7583, 121.1444],
    [23.101, 121.217],
    [22.616, 120.996],
  ],
};

export function normalizeCountyName(name: string): string {
  return name.trim().replace(/台/g, '臺');
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const r = 6371;
  const p1 = toRad(lat1);
  const p2 = toRad(lat2);
  const dp = toRad(lat2 - lat1);
  const dl = toRad(lng2 - lng1);
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function inferTaiwanCounty(latitude: number, longitude: number): string | null {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < 21.5 ||
    latitude > 26.5 ||
    longitude < 118.0 ||
    longitude > 122.5
  ) {
    return null;
  }

  if (latitude >= 24.25 && latitude <= 24.65 && longitude >= 118.1 && longitude <= 118.6) {
    return '金門縣';
  }
  if (latitude >= 25.85 && latitude <= 26.5 && longitude >= 119.8 && longitude <= 120.65) {
    return '連江縣';
  }
  if (latitude >= 23.1 && latitude <= 23.9 && longitude >= 119.25 && longitude <= 119.8) {
    return '澎湖縣';
  }

  if (latitude >= 25.09 && latitude <= 25.21 && longitude >= 121.68 && longitude <= 121.82) {
    return '基隆市';
  }
  if (latitude >= 24.76 && latitude <= 24.822 && longitude >= 120.9 && longitude <= 121.015) {
    return '新竹市';
  }
  if (latitude >= 23.45 && latitude <= 23.51 && longitude >= 120.41 && longitude <= 120.49) {
    return '嘉義市';
  }

  let bestCounty: string | null = null;
  let bestDist = Infinity;
  for (const [county, anchors] of Object.entries(COUNTY_ANCHORS)) {
    for (const [aLat, aLng] of anchors) {
      const d = haversineKm(latitude, longitude, aLat, aLng);
      if (d < bestDist) {
        bestDist = d;
        bestCounty = county;
      }
    }
  }
  return bestCounty;
}

export function selectedRegionsFromTags(preferredTags: readonly string[]): Set<string> {
  const regions = new Set<string>();
  for (const tag of preferredTags) {
    const norm = normalizeCountyName(tag);
    if (TAIWAN_COUNTY_SET.has(norm)) regions.add(norm);
  }
  return regions;
}

export function filterPostsByPreferredRegions<
  T extends { location?: { latitude: number; longitude: number } | null },
>(posts: readonly T[], preferredTags: readonly string[] = []): T[] {
  const regions = selectedRegionsFromTags(preferredTags);
  if (!regions.size) return [...posts];
  return posts.filter((post) => {
    if (!post.location) return false;
    const county = inferTaiwanCounty(post.location.latitude, post.location.longitude);
    return county !== null && regions.has(county);
  });
}
