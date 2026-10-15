import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

import { getEnv } from '@/lib/config';

import { createChunkedStorage } from './chunkedStorage';

/**
 * Supabase session storage in the device keychain/keystore. Sessions are larger than
 * SecureStore's ~2 KB value limit, so they are stored in chunks (chunkedStorage.ts).
 */
const secureStorage = createChunkedStorage({
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK }),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
});

let client: SupabaseClient | null = null;

/**
 * Only the anon key lives in the app. Users get a Supabase session ONLY via the
 * `shopify-auth-exchange` Edge Function, which verifies the Shopify Customer
 * Account token server-side (hard rule 6).
 */
export function getSupabase(): SupabaseClient {
  if (!client) {
    const env = getEnv();
    client = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY, {
      auth: {
        storage: secureStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}
