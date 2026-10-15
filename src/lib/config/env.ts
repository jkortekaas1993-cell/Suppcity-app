import { z } from 'zod';

/**
 * Public runtime configuration. Only EXPO_PUBLIC_* values (bundled into the app)
 * belong here. Server secrets live in Supabase Edge Function secrets only.
 */
const envSchema = z.object({
  EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN: z.string().min(1),
  EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN: z.string().min(1),
  EXPO_PUBLIC_SUPABASE_URL: z.string().url(),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

export type AppEnv = z.infer<typeof envSchema>;

/** Pure parser, testable without process.env. */
export function parseEnv(raw: Record<string, string | undefined>): AppEnv {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const missing = result.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Invalid app config (check .env against .env.example): ${missing}`);
  }
  return result.data;
}

let cached: AppEnv | null = null;

/**
 * Lazily read env. Expo inlines EXPO_PUBLIC_* only when accessed as
 * `process.env.EXPO_PUBLIC_X` literally, so keep the explicit object below.
 */
export function getEnv(): AppEnv {
  if (!cached) {
    cached = parseEnv({
      EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN: process.env.EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN,
      EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN: process.env.EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN,
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    });
  }
  return cached;
}
