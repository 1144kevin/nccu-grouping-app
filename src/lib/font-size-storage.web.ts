import type { StateStorage } from 'zustand/middleware';

export const fontSizeStorage: StateStorage = {
  getItem: (key) => { try { return typeof localStorage === 'undefined' ? null : localStorage.getItem(key); } catch { return null; } },
  setItem: (key, value) => { try { localStorage.setItem(key, value); } catch { /* Keep the preference for this session if storage is unavailable. */ } },
  removeItem: (key) => { try { localStorage.removeItem(key); } catch { /* No stored preference to clear. */ } },
};
