// STUB — Backend&Sync builder implements.
//
// POST { shopifyAccessToken } -> { supabaseSession }
// 1. Verify the Shopify Customer Account API access token SERVER-SIDE by calling
//    the Customer Account API (pinned version) — never trust a customer id from the client.
// 2. Upsert auth user + public.profiles(shopify_customer_id) with the service role key.
// 3. Mint and return a Supabase session for that user.
// Secrets (SUPABASE_SERVICE_ROLE_KEY, SHOPIFY_*) come from `supabase secrets`, never the app.
import { json } from '../_shared/cors.ts';

Deno.serve((_req: Request) => json({ error: 'not_implemented' }, 501));
