import * as SecureStore from 'expo-secure-store';
import { createSessionStorage } from './session-storage';

const KEY = 'nccu-grouping.local-core.access-token';

export const tokenStorage = createSessionStorage(
  () => SecureStore.getItemAsync(KEY),
  (value) => SecureStore.setItemAsync(KEY, value),
  () => SecureStore.deleteItemAsync(KEY),
);
