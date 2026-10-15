import { z } from 'zod';

/**
 * App ↔ backend contracts as the Shop&Login side expects them.
 * DRAFT: Orchestrator aligns these with Backend&Sync's Edge Functions.
 *
 * ── POST {SUPABASE_URL}/functions/v1/shopify-auth-exchange ──────────────────
 * Headers: apikey: <anon key>, Authorization: Bearer <anon key>, Content-Type: application/json
 * Body:    ShopifyAuthExchangeRequest
 * 200:     ShopifyAuthExchangeResponse   (Supabase session for the verified customer)
 * 401:     { error: 'invalid_shopify_token' }  token rejected by Shopify
 * 4xx/5xx: { error: string }
 * The function MUST verify the token server-side against the Customer Account API
 * (hard rule 6) and derive the Shopify customer id itself; the app never sends it.
 *
 * ── POST {SUPABASE_URL}/functions/v1/delete-account ─────────────────────────
 * Headers: apikey, Authorization: Bearer <supabase access token>
 * Body:    {} (empty)
 * 204 (or 200 { deleted: true }): auth user + all public rows deleted (cascade).
 * Shopify order data is NOT deleted (statutory retention at Shopify).
 */

export const SHOPIFY_AUTH_EXCHANGE_FUNCTION = 'shopify-auth-exchange';
export const DELETE_ACCOUNT_FUNCTION = 'delete-account';

export const shopifyAuthExchangeRequestSchema = z.object({
  /** Customer Account API access token, straight from the token endpoint. */
  shopifyAccessToken: z.string().min(1),
});
export type ShopifyAuthExchangeRequest = z.infer<typeof shopifyAuthExchangeRequestSchema>;

export const supabaseSessionSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().positive(),
  expires_at: z.number().optional(),
  token_type: z.string().optional(),
});

export const shopifyAuthExchangeResponseSchema = z.object({
  supabaseSession: supabaseSessionSchema,
  /** Supabase auth user id (uuid). */
  userId: z.string().min(1),
  /** True on first login: app then calls SyncSource.claimAnonymousRows(userId). */
  isNewUser: z.boolean().optional().default(false),
});
export type ShopifyAuthExchangeResponse = z.infer<typeof shopifyAuthExchangeResponseSchema>;

export const edgeErrorSchema = z.object({ error: z.string() });

export type ExchangeOutcome =
  | { ok: true; value: ShopifyAuthExchangeResponse }
  | { ok: false; reason: 'invalid_shopify_token' | 'server' | 'invalid_response'; status: number };

/** Pure interpretation of the exchange HTTP response (tested). */
export function interpretExchangeResponse(status: number, body: unknown): ExchangeOutcome {
  if (status >= 200 && status < 300) {
    const parsed = shopifyAuthExchangeResponseSchema.safeParse(body);
    return parsed.success ? { ok: true, value: parsed.data } : { ok: false, reason: 'invalid_response', status };
  }
  const err = edgeErrorSchema.safeParse(body);
  if (status === 401 || (err.success && err.data.error === 'invalid_shopify_token')) {
    return { ok: false, reason: 'invalid_shopify_token', status };
  }
  return { ok: false, reason: 'server', status };
}

// ── Interfaces Backend&Sync implements (UI codes against these) ────────────────

/** Mirrors `consent_type` in supabase/migrations/0001_init.sql (hard rule 2). */
export type ConsentType = 'marketing_email' | 'marketing_push' | 'health_sync' | 'analytics' | 'pt_share';

export interface ConsentState {
  type: ConsentType;
  granted: boolean;
  /** ISO timestamp of the latest grant/revoke event, null if never set. */
  updatedAt: string | null;
}

/**
 * Backed by `consents` (append-only) + `current_consents`. `setConsent` appends a
 * grant or revoke event with timestamp and policy version; it never updates rows.
 */
export interface ConsentService {
  list(): Promise<ConsentState[]>;
  setConsent(type: ConsentType, granted: boolean): Promise<ConsentState>;
}

/** Points feature delivers the real component; this is the slot interface for the Ik tab. */
export interface PointsBalanceSource {
  /** null = not eligible / unknown (e.g. not 18+ confirmed). */
  balance(): Promise<number | null>;
}

/** profiles.pt_code. Server validates the code; client only submits it. */
export interface PtCodeService {
  current(): Promise<string | null>;
  link(code: string): Promise<{ ok: true } | { ok: false; reason: 'invalid' | 'server' }>;
  unlink(): Promise<void>;
}

/** PT codes: 4–12 letters/digits, case-insensitive, stored uppercase. */
export function normalisePtCode(input: string): string | null {
  const code = input.trim().toUpperCase().replace(/\s+/g, '');
  return /^[A-Z0-9]{4,12}$/.test(code) ? code : null;
}
