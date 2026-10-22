import { createPickupFavorites } from './pickup-favorites';

export const pickupFavorites = createPickupFavorites({
  get: async (key) => localStorage.getItem(key),
  set: async (key, value) => { localStorage.setItem(key, value); },
  remove: async (key) => { localStorage.removeItem(key); },
});
