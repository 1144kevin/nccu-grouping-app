import { expect, it } from '@jest/globals';
import { createSessionStorage } from './session-storage';

function fixture(initial: string | null = null) {
  let raw = initial;
  return createSessionStorage(async () => raw, async (value) => { raw = value; }, async () => { raw = null; });
}

it('reads previous access-only sessions and atomically rotates both credentials', async () => {
  const storage = fixture('legacy-token');
  expect(await storage.get()).toBe('legacy-token');
  expect(await storage.getRefresh()).toBeNull();
  await storage.setSession({ access_token: 'old', refresh_token: 'refresh-old' });
  expect(await storage.replace('old', { access_token: 'new', refresh_token: 'refresh-new' })).toBe(true);
  expect(await storage.get()).toBe('new');
  expect(await storage.getRefresh()).toBe('refresh-new');
});

it('does not resurrect a logged-out session or overwrite another account', async () => {
  const storage = fixture();
  await storage.setSession({ access_token: 'old', refresh_token: 'refresh' });
  await storage.clear();
  expect(await storage.replace('old', { access_token: 'late' })).toBe(false);
  await storage.set('other-account');
  expect(await storage.replace('old', { access_token: 'late' })).toBe(false);
  expect(await storage.get()).toBe('other-account');
});
