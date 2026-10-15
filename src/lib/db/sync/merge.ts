import type { SyncRow } from './types';

/**
 * Pure last-write-wins merge. Mirrors the server trigger `sync_row_write`
 * (supabase/migrations/0002_sync.sql) so every replica converges:
 *  - newer updated_at wins; on a tie the remote (server-sequenced) row wins;
 *  - deletes are sticky: a deleted row never comes back, and a delete always
 *    survives even when it is older than the other side's content edit;
 *  - identical rows → no write.
 * Returns the row to store locally, or null when local already matches.
 */
export function mergeRow<T extends SyncRow>(local: T | null | undefined, remote: T): T | null {
  if (!local) return remote;

  const cmp = compareTimestamps(remote.updated_at, local.updated_at);
  let winner: T = cmp >= 0 ? remote : local;
  const deletedAt = earliest(local.deleted_at, remote.deleted_at);
  if (deletedAt !== winner.deleted_at) winner = { ...winner, deleted_at: deletedAt };
  // keep identity fields from the existing local row
  winner = { ...winner, id: local.id, created_at: local.created_at };

  return rowsEqual(winner, local) ? null : winner;
}

/** ISO-8601 comparison that tolerates different precisions/offsets. */
export function compareTimestamps(a: string, b: string): number {
  const ta = toMicros(a);
  const tb = toMicros(b);
  return ta === tb ? 0 : ta > tb ? 1 : -1;
}

function toMicros(iso: string): number {
  // Date keeps milliseconds only; Postgres returns microseconds. Add them back.
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new Error(`Invalid timestamp: ${iso}`);
  const frac = /\.(\d+)/.exec(iso)?.[1] ?? '';
  const extraMicros = Number(frac.slice(3, 6).padEnd(3, '0'));
  return ms * 1000 + extraMicros;
}

function earliest(a: string | null, b: string | null): string | null {
  if (a === null) return b;
  if (b === null) return a;
  return compareTimestamps(a, b) <= 0 ? a : b;
}

function rowsEqual(a: SyncRow, b: SyncRow): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  keys.delete('server_updated_at');
  for (const k of keys) {
    const va = a[k];
    const vb = b[k];
    if (k.endsWith('_at') && typeof va === 'string' && typeof vb === 'string') {
      if (compareTimestamps(va, vb) !== 0) return false;
    } else if (JSON.stringify(va ?? null) !== JSON.stringify(vb ?? null)) {
      return false;
    }
  }
  return true;
}

/** Split into batches of at most `size`. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size < 1) throw new Error('batch size must be >= 1');
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Push cursor: rewind by `overlapMs` to tolerate small clock adjustments (replays are no-ops). */
export function rewind(iso: string | null, overlapMs: number): string | null {
  if (!iso) return null;
  return new Date(Date.parse(iso) - overlapMs).toISOString();
}

/** Latest updated_at among rows (null for none). */
export function maxUpdatedAt(rows: readonly { updated_at: string }[]): string | null {
  let max: string | null = null;
  for (const r of rows) if (max === null || compareTimestamps(r.updated_at, max) > 0) max = r.updated_at;
  return max;
}
