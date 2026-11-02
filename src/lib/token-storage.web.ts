import { createSessionStorage } from './session-storage';
import { createInstalledSessionStorage, isInstalledWebApp } from './installed-session-storage.web';
// Ordinary browser tabs stay isolated; installed Web Apps persist across closes.
// Never use localStorage for credentials or persist Google's one-use PKCE proof.
const KEY = 'nccu-grouping.local-core.access-token';
const installed = isInstalledWebApp();
const persistent = createInstalledSessionStorage(
  typeof window === 'undefined' ? undefined : window.indexedDB,
);

async function read(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  if (!installed) return window.sessionStorage.getItem(KEY);
  const saved = await persistent.read();
  if (saved !== null) return saved;
  // Upgrade an already signed-in installation without forcing another login.
  const previous = window.sessionStorage.getItem(KEY);
  if (previous !== null) {
    await persistent.write(previous);
    window.sessionStorage.removeItem(KEY);
  }
  return previous;
}

export const tokenStorage = createSessionStorage(
  read,
  async (value) => {
    if (installed) {
      await persistent.write(value);
      window.sessionStorage.removeItem(KEY);
    } else window.sessionStorage.setItem(KEY, value);
  },
  async () => {
    if (installed) await persistent.remove();
    if (typeof window !== 'undefined') window.sessionStorage.removeItem(KEY);
  },
  installed ? persistent.replace : undefined,
);
