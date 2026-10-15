import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import type { PullCursor, PullPage, RemoteRow, RemoteSyncAdapter, SyncRow, SyncTable } from './types';

const RemoteRowSchema = z
  .object({
    id: z.string(),
    user_id: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
    deleted_at: z.string().nullable(),
    server_updated_at: z.string(),
  })
  .passthrough();

/** PostgREST `or` filter for keyset pagination on (server_updated_at, id). Pure. */
export function keysetFilter(after: PullCursor): string {
  const ts = `"${after.serverUpdatedAt}"`;
  if (!after.id) return `server_updated_at.gt.${ts}`;
  return `server_updated_at.gt.${ts},and(server_updated_at.eq.${ts},id.gt.${after.id})`;
}

/**
 * Supabase implementation of the remote side. RLS limits every query to the
 * signed-in user; the server trigger `sync_row_write` applies LWW on upsert.
 */
export function createSupabaseSyncAdapter(client: SupabaseClient): RemoteSyncAdapter {
  return {
    async push(table: SyncTable, rows: SyncRow[]) {
      if (rows.length === 0) return;
      const { error } = await client.from(table).upsert(rows, { onConflict: 'id', ignoreDuplicates: false });
      if (error) throw error;
    },
    async pull(table: SyncTable, after: PullCursor | null, limit: number): Promise<PullPage> {
      let q = client
        .from(table)
        .select('*')
        .order('server_updated_at', { ascending: true })
        .order('id', { ascending: true })
        .limit(limit);
      if (after) q = q.or(keysetFilter(after));
      const { data, error } = await q;
      if (error) throw error;
      const rows = z.array(RemoteRowSchema).parse(data ?? []) as RemoteRow[];
      const last = rows[rows.length - 1];
      return {
        rows,
        next: last ? { serverUpdatedAt: last.server_updated_at, id: last.id } : null,
        hasMore: rows.length === limit,
      };
    },
  };
}
