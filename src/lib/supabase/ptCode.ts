import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { getSupabase } from './client';

/**
 * PT code on the user's own `profiles` row (RLS: profiles_update_own). Minimal
 * implementation: the format is checked here AND by a CHECK constraint
 * (supabase/migrations/0005_pt_code.sql). There is no trainer registry yet, so any
 * well-formed code is accepted; sharing training data with a PT additionally needs
 * the separate `pt_share` consent (hard rule 2).
 */
export interface PtCodeService {
  current(): Promise<string | null>;
  link(code: string): Promise<{ ok: true } | { ok: false; reason: 'invalid' | 'server' }>;
  unlink(): Promise<void>;
}

/** PT codes: 4–12 letters/digits, case-insensitive, stored uppercase. Pure. */
export function normalisePtCode(input: string): string | null {
  const code = input.trim().toUpperCase().replace(/\s+/g, '');
  return /^[A-Z0-9]{4,12}$/.test(code) ? code : null;
}

const ProfilePtRow = z.object({ pt_code: z.string().nullable() }).nullable();

export function createPtCodeService(
  client: SupabaseClient = getSupabase(),
  getUserId: () => Promise<string | null> = async () => (await client.auth.getSession()).data.session?.user.id ?? null,
): PtCodeService {
  async function setCode(code: string | null): Promise<boolean> {
    const uid = await getUserId();
    if (!uid) return false;
    const { error } = await client.from('profiles').update({ pt_code: code }).eq('user_id', uid);
    return !error;
  }
  return {
    async current() {
      const uid = await getUserId();
      if (!uid) return null;
      const { data, error } = await client.from('profiles').select('pt_code').eq('user_id', uid).maybeSingle();
      if (error) throw error;
      return ProfilePtRow.parse(data)?.pt_code ?? null;
    },
    async link(input) {
      const code = normalisePtCode(input);
      if (!code) return { ok: false, reason: 'invalid' };
      return (await setCode(code)) ? { ok: true } : { ok: false, reason: 'server' };
    },
    async unlink() {
      if (!(await setCode(null))) throw new Error('pt_code unlink failed');
    },
  };
}
