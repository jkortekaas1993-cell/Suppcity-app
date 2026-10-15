import type { ConsentState } from '@/lib/supabase/consents';
import type { ConsentType } from '@/lib/supabase/types';

/** Dutch copy per consent. Each one is separate and can be withdrawn (hard rule 2). */
export const CONSENT_COPY: Record<ConsentType, { title: string; body: string }> = {
  marketing_email: {
    title: 'Aanbiedingen per e-mail',
    body: 'Nieuws en acties van Supp City in je mailbox. Nooit op basis van je trainingen.',
  },
  marketing_push: {
    title: 'Aanbiedingen als pushmelding',
    body: 'Maximaal één promotiemelding per week. Voorraadherinneringen staan hier los van.',
  },
  health_sync: {
    title: 'Koppeling met Apple Gezondheid / Health Connect',
    body: 'Trainingen uitwisselen met je gezondheidsapp. Deze gegevens gebruiken we nooit voor marketing.',
  },
  analytics: {
    title: 'Anonieme gebruiksstatistieken',
    body: 'Helpt ons de app te verbeteren. Zonder gewichten, sets of lichaamsgegevens.',
  },
  pt_share: {
    title: 'Delen met je personal trainer',
    body: 'Je gekoppelde PT kan je trainingen inzien. Intrekken stopt het delen direct.',
  },
};

export const CONSENT_ORDER: readonly ConsentType[] = [
  'marketing_email',
  'marketing_push',
  'analytics',
  'health_sync',
  'pt_share',
];

/** Optimistic toggle helper: apply locally, roll back on failure. Pure. */
export function applyConsent(
  states: readonly ConsentState[],
  type: ConsentType,
  granted: boolean,
  nowIso: string,
  policyVersion: string,
): ConsentState[] {
  const exists = states.some((s) => s.type === type);
  const next = states.map((s) => (s.type === type ? { ...s, granted, policyVersion, changedAt: nowIso } : s));
  return exists ? next : [...next, { type, granted, policyVersion, changedAt: nowIso }];
}
