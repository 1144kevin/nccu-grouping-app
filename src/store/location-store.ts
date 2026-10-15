import { create } from 'zustand';
import * as Location from 'expo-location';
import type { Coordinates } from '@/types/domain';

type LocationState = {
  coordinates?: Coordinates;
  updatedAt?: number;
  loading: boolean;
  error?: string;
  requestLocation: () => Promise<Coordinates | undefined>;
};

// Viewer position is kept only in memory and is never included in another user's post.
export const useLocationStore = create<LocationState>((set, get) => ({
  loading: false,
  requestLocation: async () => {
    if (get().loading) return;
    set({ loading: true, error: undefined, coordinates: undefined, updatedAt: undefined });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        set({ error: '未允許定位，無法計算距離。可在瀏覽器或系統設定開啟位置權限。' });
        return;
      }
      const position = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), 15000); }),
      ]);
      const coordinates = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      set({ coordinates, updatedAt: Date.now() });
      return coordinates;
    } catch {
      set({ error: '暫時無法取得位置，請確認定位服務已開啟後再試。' });
      return;
    } finally {
      if (timer) clearTimeout(timer);
      set({ loading: false });
    }
  },
}));
