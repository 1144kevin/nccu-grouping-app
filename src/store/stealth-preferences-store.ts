import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { fontSizeStorage } from '@/lib/font-size-storage';
import { parseStealthPreferences, type StealthPreferences } from '@/lib/stealth-preferences';

export const useStealthPreferencesStore = create<{
  accounts: Record<string, StealthPreferences>;
  save: (actor: string, preferences: StealthPreferences) => void;
}>()(
  persist(
    (set) => ({
      accounts: {},
      save: (actor, preferences) =>
        set((state) => ({
          accounts: { ...state.accounts, [actor]: parseStealthPreferences(preferences) },
        })),
    }),
    {
      name: 'nccu-grouping.stealth-preferences',
      storage: createJSONStorage(() => fontSizeStorage),
      partialize: (state) => ({ accounts: state.accounts }),
      merge: (persisted, current) => {
        const accounts = (persisted as { accounts?: unknown } | undefined)?.accounts;
        if (!accounts || typeof accounts !== 'object' || Array.isArray(accounts)) return current;
        return {
          ...current,
          accounts: Object.fromEntries(
            Object.entries(accounts).map(([actor, preferences]) => [
              actor,
              parseStealthPreferences(preferences),
            ]),
          ),
        };
      },
    },
  ),
);
