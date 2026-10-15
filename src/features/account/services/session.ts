import {
  customerSession,
  getCustomerAccount,
  signInWithShopify,
  signOutFromShopify,
  userMessageFor,
} from '@/lib/shopify';
import { getSupabase } from '@/lib/supabase';
import { cartStore, stockStore } from '@/features/shop';

import { exchangeShopifyToken, requestAccountDeletion } from './edgeFunctions';

export type SignInOutcome =
  | { status: 'signed_in'; linked: boolean; message: string | null }
  | { status: 'cancelled' }
  | { status: 'failed'; message: string };

/**
 * Login: Shopify Customer Account (PKCE) → shopify-auth-exchange → Supabase session.
 * If the exchange fails the shop login still works (orders, reorder); sync waits.
 */
export async function signIn(): Promise<SignInOutcome> {
  try {
    const result = await signInWithShopify();
    if (!result.ok) return result.reason === 'cancelled' ? { status: 'cancelled' } : { status: 'failed', message: 'Inloggen is niet gelukt.' };
    customerSession.markSignedIn();
    const exchange = await exchangeShopifyToken(result.accessToken);
    // TODO(Backend&Sync): on exchange.value.isNewUser call SyncSource.claimAnonymousRows(userId).
    return {
      status: 'signed_in',
      linked: exchange.ok,
      message: exchange.ok ? null : 'Je bent ingelogd bij de shop. Je trainingen synchroniseren later.',
    };
  } catch (error) {
    return { status: 'failed', message: userMessageFor(error) };
  }
}

export async function signOut(): Promise<void> {
  await Promise.allSettled([signOutFromShopify(), getSupabase().auth.signOut()]);
  await cartStore.reset(); // the cart carried the buyer identity
  customerSession.markSignedOut();
}

export async function deleteAccount(): Promise<{ ok: true } | { ok: false; message: string }> {
  const res = await requestAccountDeletion();
  if (!res.ok) {
    return {
      ok: false,
      message:
        res.reason === 'not_signed_in'
          ? 'Log opnieuw in om je account te verwijderen.'
          : 'Verwijderen is niet gelukt. Probeer het later opnieuw of mail info@suppcity.nl.',
    };
  }
  await stockStore.clear();
  // TODO(Tracker/Backend&Sync): wipe the local SQLite tracker DB here (docs/architecture.md).
  await signOut();
  return { ok: true };
}

export async function loadProfileName(): Promise<string | null> {
  try {
    const profile = await (await getCustomerAccount()).profile();
    return profile.firstName ?? profile.email;
  } catch {
    return null;
  }
}
