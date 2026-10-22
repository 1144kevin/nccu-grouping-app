import type { PostLocation } from '@/types/domain';
export type CampusPickupPlace = PostLocation & { id: string; requiresPin?: boolean };
// Reference points from https://bdmap.nccu.edu.tw/zh-tw/Map/GetMapList/1
// checked 2026-10-22. Building points are not verified pickup entrances.
export const campusPickupPlaces: CampusPickupPlace[] = [
  { id: 'main-gate', name: '正門', latitude: 24.98756683, longitude: 121.57604992 },
  // OSM crossing at the McDonald's-side campus approach; require actual pickup pin.
  { id: 'west-gate', name: '麥側（指南路側門）', latitude: 24.987812, longitude: 121.5748528, requiresPin: true },
  { id: 'commerce', name: '商學院', latitude: 24.9866747, longitude: 121.576555 },
  { id: 'dorm-9', name: '莊九（莊敬九舍）', latitude: 24.9865623, longitude: 121.5783596 },
  { id: 'arts', name: '藝文中心', latitude: 24.9815737, longitude: 121.5721284 },
  // OSM node 1749424521, campus approach via Hengguang Bridge; verify pickup side.
  { id: 'rear-gate', name: '政大後門', latitude: 24.9797561, longitude: 121.568145, requiresPin: true },
];
