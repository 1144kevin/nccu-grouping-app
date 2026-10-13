import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { fontSizeStorage } from '@/lib/font-size-storage';

export const fontSizes = {
  small: { label: '較小', scale: 0.82 },
  standard: { label: '標準', scale: 0.9 },
  large: { label: '較大', scale: 1 },
} as const;
export type FontSize = keyof typeof fontSizes;

type FontSizeState = {
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
};

export const useFontSizeStore = create<FontSizeState>()(persist(
  (set) => ({
    fontSize: 'standard',
    setFontSize: (fontSize) => set({ fontSize }),
  }),
  {
    name: 'nccu-grouping.font-size',
    storage: createJSONStorage(() => fontSizeStorage),
    partialize: (state) => ({ fontSize: state.fontSize }),
    merge: (persisted, current) => {
      const saved = (persisted as { fontSize?: unknown } | undefined)?.fontSize;
      return { ...current, fontSize: saved === 'small' || saved === 'standard' || saved === 'large' ? saved : 'standard' };
    },
  },
));
