import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { getSupabase } from './client';
import type { ConsentType } from './types';

export const CONSENT_TYPES = ['marketing_email', 'marketing_push', 'health_sync', 'analytics', 'pt_share'] as const satisfies readonly ConsentType[];

/** Current state of one consent. `granted: false` + `changedAt: null` = never asked. */
export interface ConsentState {
  type: ConsentType;
  granted: boolean;
  policyVersion: string | null;
  changedAt: string | null;
}

/**
 * Hard rule 2: each consent separate, revocable, logged with a server timestamp.
 * Grant/revoke append an event via RPC `set_consent`; state comes from `current_consents`.
 */
export interface ConsentService {
  list(): Promise<ConsentState[]>;
  grant(type: ConsentType, policyVersion: string): Promise<ConsentState>;
  revoke(type: ConsentType, policyVersion: string): Promise<ConsentState>;
}

const CurrentConsentRow = z.object({
  consent_type: z.enum(CONSENT_TYPES),
  granted: z.boolean(),
  policy_version: z.string(),
  created_at: z.string(),
});

/** Pure: fill in every known type (unknown ones default to not granted). */
export function toConsentStates(rows: z.infer<typeof CurrentConsentRow>[]): ConsentState[] {
  return CONSENT_TYPES.map((type) => {
    const row = rows.find((r) => r.consent_type === type);
    return {
      type,
      granted: row?.granted ?? false,
      policyVersion: row?.policy_version ?? null,
      changedAt: row?.created_at ?? null,
    };
  });
}

export function createConsentService(client: SupabaseClient = getSupabase()): ConsentService {
  async function set(type: ConsentType, granted: boolean, policyVersion: string): Promise<ConsentState> {
    const { data, error } = await client.rpc('set_consent', {
      p_consent_type: type,
      p_granted: granted,
      p_policy_version: policyVersion,
    });
    if (error) throw error;
    const row = CurrentConsentRow.parse(data);
    return { type: row.consent_type, granted: row.granted, policyVersion: row.policy_version, changedAt: row.created_at };
  }
  return {
    async list() {
      const { data, error } = await client
        .from('current_consents')
        .select('consent_type, granted, policy_version, created_at');
      if (error) throw error;
      return toConsentStates(z.array(CurrentConsentRow).parse(data ?? []));
    },
    grant: (type, policyVersion) => set(type, true, policyVersion),
    revoke: (type, policyVersion) => set(type, false, policyVersion),
  };
}
