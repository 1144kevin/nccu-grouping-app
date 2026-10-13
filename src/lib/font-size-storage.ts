import * as SecureStore from 'expo-secure-store';
import type { StateStorage } from 'zustand/middleware';

export const fontSizeStorage: StateStorage = {
  getItem: async (key) => { try { return await SecureStore.getItemAsync(key); } catch { return null; } },
  setItem: async (key, value) => { try { await SecureStore.setItemAsync(key, value); } catch { /* Keep the preference for this session if storage is unavailable. */ } },
  removeItem: async (key) => { try { await SecureStore.deleteItemAsync(key); } catch { /* No stored preference to clear. */ } },
};
