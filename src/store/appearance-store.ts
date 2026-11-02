import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { fontSizeStorage } from '@/lib/font-size-storage';

export type ColorMode = 'system' | 'light' | 'dark';
export const useAppearanceStore = create<{
  mode: ColorMode;
  setMode: (mode: ColorMode) => void;
}>()(
  persist((set) => ({ mode: 'system', setMode: (mode) => set({ mode }) }), {
    name: 'nccu-grouping.appearance',
    storage: createJSONStorage(() => fontSizeStorage),
    partialize: ({ mode }) => ({ mode }),
    merge: (persisted, current) => {
      const mode = (persisted as { mode?: string })?.mode;
      return { ...current, mode: mode === 'light' || mode === 'dark' ? mode : 'system' };
    },
  }),
);
