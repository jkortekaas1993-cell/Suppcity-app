import { useSyncExternalStore } from 'react';

import { customerTokens, onCustomerSignedOut } from './customerAuthNative';

/**
 * Whether a Shopify customer is signed in (tokens present). Shared by the shop
 * (reorder, authenticated checkout) and account features.
 */
export type CustomerSessionStatus = 'unknown' | 'signedOut' | 'signedIn';

let status: CustomerSessionStatus = 'unknown';
const listeners = new Set<() => void>();

function set(next: CustomerSessionStatus) {
  if (next === status) return;
  status = next;
  listeners.forEach((l) => l());
}

onCustomerSignedOut(() => set('signedOut'));

export const customerSession = {
  get: (): CustomerSessionStatus => status,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  /** Read tokens from SecureStore (call once at startup and after login/logout). */
  async load(): Promise<CustomerSessionStatus> {
    const tokens = await customerTokens.current().catch(() => null);
    set(tokens ? 'signedIn' : 'signedOut');
    return status;
  },
  markSignedIn: () => set('signedIn'),
  markSignedOut: () => set('signedOut'),
  /** Valid access token or null when signed out (never throws). */
  async accessTokenOrNull(): Promise<string | null> {
    if (status === 'signedOut') return null;
    try {
      return await customerTokens.getValidAccessToken();
    } catch {
      return null;
    }
  },
};

void customerSession.load();

export function useCustomerSession(): CustomerSessionStatus {
  return useSyncExternalStore(customerSession.subscribe, customerSession.get, customerSession.get);
}
