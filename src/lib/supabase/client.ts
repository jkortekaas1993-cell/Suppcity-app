import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

import { getEnv } from '@/lib/config';

/**
 * Supabase session storage in the device keychain/keystore.
 * Note: SecureStore values are limited to ~2KB on some platforms; if sessions
 * outgrow that, Backend&Sync swaps in an encrypted-chunk adapter here.
 */
const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

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
