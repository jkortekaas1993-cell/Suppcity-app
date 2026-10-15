import type { TrackerTable } from '../schema';

/**
 * Sync contracts. The engine is backend-agnostic: `SyncEngine` is what the app
 * uses; `CustomSyncEngine` (this folder) implements it now, a PowerSync-backed
 * implementation can replace it later without touching callers.
 */

export type SyncTable = TrackerTable;

/**
 * Push/pull order respects foreign keys on both sides (parents first):
 * custom exercises → routines → workouts → routine_exercises → sets.
 */
export const SYNC_ORDER: readonly SyncTable[] = ['exercises', 'routines', 'workouts', 'routine_exercises', 'sets'];

/** A row in the wire format (Supabase column names and types). */
export interface SyncRow {
  id: string;
  user_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  [column: string]: unknown;
}

/** A pulled row additionally carries the server pull cursor. */
export interface RemoteRow extends SyncRow {
  server_updated_at: string;
}

export interface PullCursor {
  serverUpdatedAt: string;
  id: string;
}

export interface PullPage {
  rows: RemoteRow[];
  /** Cursor after the last row of this page; null when the page was empty. */
  next: PullCursor | null;
  hasMore: boolean;
}

/** Remote side (Supabase now). All methods may throw; the engine retries. */
export interface RemoteSyncAdapter {
  /** Idempotent upsert of a batch; the server applies last-write-wins. */
  push(table: SyncTable, rows: SyncRow[]): Promise<void>;
  /** Keyset page of rows with (server_updated_at, id) > cursor, ascending. */
  pull(table: SyncTable, after: PullCursor | null, limit: number): Promise<PullPage>;
}

/**
 * Local side. Implemented by the Tracker builder on expo-sqlite (see
 * `SyncSource` in src/lib/db/repositories.ts) plus `getByIds` for merging.
 * Rows are in the LOCAL format (SQLite types); the engine converts.
 */
export interface LocalSyncStore {
  /** Rows (incl. soft-deleted) with updated_at > updatedAfter (null = all). */
  changesSince(table: SyncTable, updatedAfter: string | null): Promise<Record<string, unknown>[]>;
  /** Rows by id, incl. soft-deleted; missing ids are omitted. */
  getByIds(table: SyncTable, ids: string[]): Promise<Record<string, unknown>[]>;
  /** Write already-merged rows verbatim (keep their updated_at; no bump). */
  applyRemote(table: SyncTable, rows: Record<string, unknown>[]): Promise<void>;
  /** Set user_id on rows that have none (first login on this device). */
  claimAnonymousRows(userId: string): Promise<void>;
}

export interface CursorStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export interface TableReport {
  pushed: number;
  pulled: number;
  applied: number;
}

export interface SyncReport {
  ok: boolean;
  startedAt: string;
  finishedAt: string;
  tables: Partial<Record<SyncTable, TableReport>>;
  error?: string;
}

/** What the app depends on. */
export interface SyncEngine {
  /** Push local changes, then pull remote ones. Concurrent calls share one run. */
  syncNow(): Promise<SyncReport>;
  /** Forget cursors (e.g. after sign-out or account deletion). */
  reset(): Promise<void>;
}
