import * as SecureStore from 'expo-secure-store';

import type { KeyValueStore } from './customerSession';

/** Small secrets/flags in the device keychain/keystore (values must stay < ~2 KB). */
export const secureKv: KeyValueStore = {
  getItem: (k) => SecureStore.getItemAsync(k),
  setItem: (k, v) => SecureStore.setItemAsync(k, v, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK }),
  removeItem: (k) => SecureStore.deleteItemAsync(k),
};
