import Storage from 'expo-sqlite/kv-store';

import type { KeyValueStore } from '@/lib/shopify';

/**
 * Non-secret local key/value (expo-sqlite's kv-store, its own DB file, so it never
 * touches the Tracker's schema). Used for UI flags and the stock counter until
 * `stock_items` gets a local table + sync.
 */
export const localKv: KeyValueStore = {
  getItem: (k) => Storage.getItem(k),
  setItem: (k, v) => Storage.setItem(k, v),
  removeItem: async (k) => {
    await Storage.removeItem(k);
  },
};
