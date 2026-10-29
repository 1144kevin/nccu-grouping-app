import { beforeEach, expect, it, jest } from '@jest/globals';
import { useStealthPreferencesStore } from './stealth-preferences-store';
import { parseStealthPreferences } from '@/lib/stealth-preferences';

jest.mock('@/lib/font-size-storage', () => ({
  fontSizeStorage: { getItem: () => null, setItem: jest.fn(), removeItem: jest.fn() },
}));
beforeEach(() => {
  useStealthPreferencesStore.setState({ accounts: {} });
});

it('keeps different accounts separate and persists edits without replacing another account', () => {
  const store = useStealthPreferencesStore.getState();
  store.save('alice', { tone: 'direct', context: '常在東側門' });
  store.save('bob', { tone: 'playful', context: '喜歡披薩' });
  expect(useStealthPreferencesStore.getState().accounts.alice.context).toBe('常在東側門');
  store.save('alice', { tone: 'warm', context: '' });
  expect(useStealthPreferencesStore.getState().accounts.bob.context).toBe('喜歡披薩');
  expect(useStealthPreferencesStore.getState().accounts.alice.context).toBe('');
});

it('restores safe defaults for malformed storage and bounds the context', () => {
  expect(parseStealthPreferences(null)).toEqual({ tone: 'warm', context: '' });
  expect(parseStealthPreferences({ tone: 'unknown', context: 42 })).toEqual({
    tone: 'warm',
    context: '',
  });
  expect(parseStealthPreferences({ context: '長'.repeat(600) }).context).toHaveLength(500);
});
