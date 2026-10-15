import { getSupabase } from './client';
import { AuthExchangeResponse, DeleteAccountResponse, FUNCTIONS, type AuthExchangeRequest } from './contracts';
import { invokeFunction } from './functions';

/**
 * Exchange the Shopify Customer Account access token (from the PKCE login, owned by
 * Shop&Login) for a Supabase session. The server verifies the token with Shopify;
 * the app never sends or stores a customer id (hard rule 6).
 * After this resolves, call the sync engine (it claims anonymous local rows).
 */
export async function signInWithShopifyToken(shopifyAccessToken: string): Promise<AuthExchangeResponse> {
  const client = getSupabase();
  const req: AuthExchangeRequest = { shopifyAccessToken };
  const res = await invokeFunction(client, FUNCTIONS.authExchange, req, AuthExchangeResponse);
  const { error } = await client.auth.setSession({
    access_token: res.session.access_token,
    refresh_token: res.session.refresh_token,
  });
  if (error) throw error;
  return res;
}

export async function signOut(): Promise<void> {
  await getSupabase().auth.signOut();
}

/**
 * Hard rule 3: deletes the account and ALL server data (cascade). The caller (Ik tab)
 * must afterwards wipe the local database. Orders remain in Shopify.
 */
export async function deleteAccount(): Promise<DeleteAccountResponse> {
  const client = getSupabase();
  const res = await invokeFunction(client, FUNCTIONS.deleteAccount, {}, DeleteAccountResponse);
  await client.auth.signOut({ scope: 'local' }); // server session is already gone
  return res;
}

/** Current user id or null (signed out / anonymous use). */
export async function currentUserId(): Promise<string | null> {
  const { data } = await getSupabase().auth.getSession();
  return data.session?.user.id ?? null;
}
