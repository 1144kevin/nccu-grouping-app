import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { fontSizeStorage } from '@/lib/font-size-storage';
import { parseStealthPreferences, type StealthPreferences } from '@/lib/stealth-preferences';
import type { StealthIntake, StealthSignalInput } from '@/lib/stealth-api';

export type PersistedStealthDraft = {
  signal: StealthSignalInput;
  facts?: StealthIntake['facts'];
  updatedAt: string;
};

export const useStealthPreferencesStore = create<{
  accounts: Record<string, StealthPreferences>;
  drafts: Record<string, PersistedStealthDraft>;
  save: (actor: string, preferences: StealthPreferences) => void;
  saveDraft: (actor: string, draft: PersistedStealthDraft) => void;
  clearDraft: (actor: string) => void;
}>()(
  persist(
    (set) => ({
      accounts: {},
      drafts: {},
      save: (actor, preferences) =>
        set((state) => ({
          accounts: { ...state.accounts, [actor]: parseStealthPreferences(preferences) },
        })),
      saveDraft: (actor, draft) =>
        set((state) => ({
          drafts: { ...state.drafts, [actor]: draft },
        })),
      clearDraft: (actor) =>
        set((state) => {
          const next = { ...state.drafts };
          delete next[actor];
          return { drafts: next };
        }),
    }),
    {
      name: 'nccu-grouping.stealth-preferences',
      storage: createJSONStorage(() => fontSizeStorage),
      partialize: (state) => ({ accounts: state.accounts, drafts: state.drafts }),
      merge: (persisted, current) => {
        const raw = persisted as { accounts?: unknown; drafts?: unknown } | undefined;
        const accounts = raw?.accounts;
        const drafts = raw?.drafts;
        return {
          ...current,
          accounts:
            accounts && typeof accounts === 'object' && !Array.isArray(accounts)
              ? Object.fromEntries(
                  Object.entries(accounts).map(([actor, preferences]) => [
                    actor,
                    parseStealthPreferences(preferences),
                  ]),
                )
              : current.accounts,
          drafts:
            drafts && typeof drafts === 'object' && !Array.isArray(drafts)
              ? (drafts as Record<string, PersistedStealthDraft>)
              : current.drafts,
        };
      },
    },
  ),
);
