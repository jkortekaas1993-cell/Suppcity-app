import type { ConsentService, PointsBalanceSource, PtCodeService } from '../contracts';

/**
 * Service slots the Backend&Sync / Points builders fill in at startup, e.g. in
 * their own module: `registerAccountServices({ consents: supabaseConsentService })`.
 * Until then the UI shows a calm "nog niet beschikbaar" state; nothing is faked.
 */
export class ServiceUnavailableError extends Error {
  constructor(service: string) {
    super(`${service} not registered yet`);
    this.name = 'ServiceUnavailableError';
  }
}

interface AccountServices {
  consents: ConsentService | null;
  ptCode: PtCodeService | null;
  points: PointsBalanceSource | null;
}

const services: AccountServices = { consents: null, ptCode: null, points: null };

export function registerAccountServices(impl: Partial<AccountServices>): void {
  Object.assign(services, impl);
}

export function getAccountServices(): Readonly<AccountServices> {
  return services;
}
