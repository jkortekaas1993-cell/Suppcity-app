import {
  customerSession,
  getCustomerAccount,
  signInWithShopify,
  signOutFromShopify,
  userMessageFor,
} from '@/lib/shopify';
import {
  deleteAccount as deleteBackendAccount,
  FunctionCallError,
  signInWithShopifyToken,
  signOut as signOutBackend,
} from '@/lib/supabase';
import { cartStore, stockStore } from '@/features/shop';

import { getAccountServices } from './registry';

export type SignInOutcome =
  | { status: 'signed_in'; linked: boolean; message: string | null }
  | { status: 'cancelled' }
  | { status: 'failed'; message: string };

/**
 * Login: Shopify Customer Account (PKCE) → `shopify-auth-exchange` (server verifies the
 * token, hard rule 6) → Supabase session → claim anonymous local rows + first sync.
 * If the exchange fails the shop login still works (orders, reorder); sync waits.
 */
export async function signIn(): Promise<SignInOutcome> {
  try {
    const result = await signInWithShopify();
    if (!result.ok) return result.reason === 'cancelled' ? { status: 'cancelled' } : { status: 'failed', message: 'Inloggen is niet gelukt.' };
    customerSession.markSignedIn();
    try {
      const exchange = await signInWithShopifyToken(result.accessToken);
      const lifecycle = getAccountServices().lifecycle;
      // Claim + sync must not block or fail the login itself.
      void lifecycle
        ?.onSignedIn({
          userId: exchange.user.id,
          isNewUser: exchange.profile.isNewUser,
          adultConfirmed: exchange.profile.adultConfirmed,
        })
        .catch(() => undefined);
      return { status: 'signed_in', linked: true, message: null };
    } catch (e) {
      const invalid = e instanceof FunctionCallError && e.code === 'shopify_token_invalid';
      return {
        status: 'signed_in',
        linked: false,
        message: invalid
          ? 'Je bent ingelogd bij de shop, maar je account kon niet worden gekoppeld. Log opnieuw in.'
          : 'Je bent ingelogd bij de shop. Je trainingen synchroniseren later.',
      };
    }
  } catch (error) {
    return { status: 'failed', message: userMessageFor(error) };
  }
}

export async function signOut(): Promise<void> {
  await Promise.allSettled([signOutFromShopify(), signOutBackend()]);
  await cartStore.reset(); // the cart carried the buyer identity
  customerSession.markSignedOut();
}

/** Hard rule 3: delete the account in the app, then wipe everything stored locally. */
export async function deleteAccount(): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await deleteBackendAccount();
  } catch (e) {
    const notSignedIn = e instanceof FunctionCallError && e.code === 'unauthorized';
    return {
      ok: false,
      message: notSignedIn
        ? 'Log opnieuw in om je account te verwijderen.'
        : 'Verwijderen is niet gelukt. Probeer het later opnieuw of mail info@suppcity.nl.',
    };
  }
  await stockStore.clear();
  await getAccountServices().lifecycle?.onAccountDeleted().catch(() => undefined);
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
