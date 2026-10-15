import type { ConsentService, PtCodeService } from '@/lib/supabase';

/**
 * Service slots filled once at app start by the app shell
 * (src/integration/AppServices.tsx). The account UI codes against the backend
 * contracts in src/lib/supabase only. Until registered, the UI shows a calm
 * "nog niet beschikbaar" state; nothing is faked.
 */

/** Cross-feature side effects of the account lifecycle (sync, local data). */
export interface AccountLifecycle {
  /** After a successful Shopify → Supabase exchange: claim local rows and start sync. */
  onSignedIn(info: { userId: string; isNewUser: boolean; adultConfirmed: boolean }): Promise<void>;
  /** After `delete-account` succeeded: wipe all local tracker data (hard rule 3). */
  onAccountDeleted(): Promise<void>;
}

interface AccountServices {
  consents: ConsentService | null;
  ptCode: PtCodeService | null;
  lifecycle: AccountLifecycle | null;
}

const services: AccountServices = { consents: null, ptCode: null, lifecycle: null };

export function registerAccountServices(impl: Partial<AccountServices>): void {
  Object.assign(services, impl);
}

export function getAccountServices(): Readonly<AccountServices> {
  return services;
}
