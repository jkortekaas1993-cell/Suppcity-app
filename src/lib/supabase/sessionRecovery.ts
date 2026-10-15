/**
 * Supabase session recovery (review M8). When Supabase reports SIGNED_OUT on its own
 * (refresh token expired/revoked) while the Shopify customer is still signed in, we
 * get a fresh Supabase session through `shopify-auth-exchange` with a VALID Shopify
 * token (the server verifies it again, hard rule 6). Without a valid Shopify token the
 * user sees a calm "Log opnieuw in". Pure: everything is injected.
 */
export interface SessionRecoveryDeps {
  /** Valid (refreshed if needed) Shopify Customer Account token, or null. */
  shopifyAccessToken(): Promise<string | null>;
  exchange(shopifyAccessToken: string): Promise<unknown>;
  /** True while our own sign-out / account deletion runs (no recovery then). */
  isSigningOut(): boolean;
}

export type RecoveryResult = 'ignored' | 'recovered' | 'login_required';

export const RELOGIN_MESSAGE = 'Je sessie is verlopen. Log opnieuw in om je trainingen te synchroniseren.';

export async function recoverSupabaseSession(event: string, deps: SessionRecoveryDeps): Promise<RecoveryResult> {
  if (event !== 'SIGNED_OUT' || deps.isSigningOut()) return 'ignored';
  const token = await deps.shopifyAccessToken().catch(() => null);
  if (!token) return 'login_required';
  try {
    await deps.exchange(token);
    return 'recovered';
  } catch {
    return 'login_required';
  }
}

// --- intentional sign-out flag + user-facing notice (tiny observable state) ----------
let intentionalSignOut = false;
let notice: string | null = null;
const listeners = new Set<() => void>();

/** Set by our own signOut()/deleteAccount(); cleared by the next successful exchange. */
export function setIntentionalSignOut(v: boolean): void {
  intentionalSignOut = v;
}
export function isIntentionalSignOut(): boolean {
  return intentionalSignOut;
}

export const authNotice = {
  get: (): string | null => notice,
  set(next: string | null): void {
    if (next === notice) return;
    notice = next;
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void): () => void {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};
