import { getEnv } from '@/lib/config';
import { getSupabase } from '@/lib/supabase';

import {
  DELETE_ACCOUNT_FUNCTION,
  interpretExchangeResponse,
  SHOPIFY_AUTH_EXCHANGE_FUNCTION,
  type ExchangeOutcome,
  type ShopifyAuthExchangeRequest,
} from '../contracts';

function functionUrl(name: string): string {
  return `${getEnv().EXPO_PUBLIC_SUPABASE_URL.replace(/\/$/, '')}/functions/v1/${name}`;
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Exchange a Shopify Customer Account token for a Supabase session (server verifies
 * the token with Shopify, hard rule 6) and install that session in supabase-js.
 */
export async function exchangeShopifyToken(shopifyAccessToken: string): Promise<ExchangeOutcome> {
  const anon = getEnv().EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const body: ShopifyAuthExchangeRequest = { shopifyAccessToken };
  let res: Response;
  try {
    res = await fetch(functionUrl(SHOPIFY_AUTH_EXCHANGE_FUNCTION), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: anon, Authorization: `Bearer ${anon}` },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, reason: 'server', status: 0 };
  }
  const outcome = interpretExchangeResponse(res.status, await readJson(res));
  if (outcome.ok) {
    const { error } = await getSupabase().auth.setSession({
      access_token: outcome.value.supabaseSession.access_token,
      refresh_token: outcome.value.supabaseSession.refresh_token,
    });
    if (error) return { ok: false, reason: 'invalid_response', status: res.status };
  }
  return outcome;
}

export type DeleteOutcome = { ok: true } | { ok: false; reason: 'not_signed_in' | 'server' };

/** Hard rule 3: in-app account deletion via the `delete-account` Edge Function. */
export async function requestAccountDeletion(): Promise<DeleteOutcome> {
  const { data } = await getSupabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, reason: 'not_signed_in' };
  try {
    const res = await fetch(functionUrl(DELETE_ACCOUNT_FUNCTION), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: getEnv().EXPO_PUBLIC_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
      body: '{}',
    });
    return res.ok ? { ok: true } : { ok: false, reason: 'server' };
  } catch {
    return { ok: false, reason: 'server' };
  }
}
