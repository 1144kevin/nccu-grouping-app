import type { PostLocation } from '@/types/domain';
export type CampusPickupPlace = PostLocation & { id: string };
// Campus reference coordinates; pickup instructions can be added after selection.
export const campusPickupPlaces: CampusPickupPlace[] = [
  { id: 'main-gate', name: '正門', latitude: 24.98756683, longitude: 121.57604992 },
  { id: 'dorm-9', name: '莊九', latitude: 24.9865623, longitude: 121.5783596 },
  { id: 'west-gate', name: '麥側', latitude: 24.987812, longitude: 121.5748528 },
];
