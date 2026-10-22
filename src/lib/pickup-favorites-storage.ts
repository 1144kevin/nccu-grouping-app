import * as SecureStore from 'expo-secure-store';
import { createPickupFavorites } from './pickup-favorites';

export const pickupFavorites = createPickupFavorites({
  get: SecureStore.getItemAsync,
  set: SecureStore.setItemAsync,
  remove: SecureStore.deleteItemAsync,
});
