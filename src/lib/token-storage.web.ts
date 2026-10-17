import { createSessionStorage } from './session-storage';
// Per-tab development session. Never use localStorage for credentials.
const KEY = 'nccu-grouping.local-core.access-token';

export const tokenStorage = createSessionStorage(
  async () => typeof window === 'undefined' ? null : window.sessionStorage.getItem(KEY),
  async (value) => { window.sessionStorage.setItem(KEY, value); },
  async () => { if (typeof window !== 'undefined') window.sessionStorage.removeItem(KEY); },
);
