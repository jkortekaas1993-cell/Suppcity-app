import { fromRemote, isOwnedBy, isSyncable, toRemote } from './mapping';
import { chunk, maxUpdatedAt, mergeRow, rewind } from './merge';
import { withRetry, type RetryOptions } from './retry';
import {
  SYNC_ORDER,
  type CursorStore,
  type LocalSyncStore,
  type PullCursor,
  type RemoteSyncAdapter,
  type SyncEngine,
  type SyncReport,
  type SyncRow,
  type SyncTable,
  type TableReport,
} from './types';

export interface CustomSyncOptions {
  local: LocalSyncStore;
  remote: RemoteSyncAdapter;
  cursors: CursorStore;
  /** Returns the signed-in user id, or null (then sync is a no-op). */
  getUserId: () => Promise<string | null>;
  batchSize?: number;
  /** Push cursor rewind (clock adjustments). Replays are server no-ops. */
  pushOverlapMs?: number;
  /** Pull cursor rewind (late-committing transactions). Merges are idempotent. */
  pullOverlapMs?: number;
  retry?: Partial<RetryOptions>;
  now?: () => Date;
}

const DEFAULT_RETRY: RetryOptions = {
  retries: 4,
  baseMs: 500,
  maxMs: 15_000,
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
};

/**
 * Phase-1 sync: push local changes (by local updated_at), then pull remote changes
 * (by server_updated_at keyset) and merge them with `mergeRow` (LWW, sticky deletes).
 * Every step is idempotent, so an interrupted run is simply repeated next time.
 */
export class CustomSyncEngine implements SyncEngine {
  private running: Promise<SyncReport> | null = null;
  private readonly o: Required<Omit<CustomSyncOptions, 'retry'>> & { retry: RetryOptions };

  constructor(opts: CustomSyncOptions) {
    this.o = {
      batchSize: 200,
      pushOverlapMs: 5 * 60_000,
      pullOverlapMs: 60_000,
      now: () => new Date(),
      ...opts,
      retry: { ...DEFAULT_RETRY, ...opts.retry },
    };
  }

  syncNow(): Promise<SyncReport> {
    if (!this.running) {
      this.running = this.run().finally(() => {
        this.running = null;
      });
    }
    return this.running;
  }

  async reset(): Promise<void> {
    const userId = await this.o.getUserId();
    if (!userId) return;
    for (const t of SYNC_ORDER) {
      await this.o.cursors.set(this.key(userId, 'push', t), '');
      await this.o.cursors.set(this.key(userId, 'pull', t), '');
    }
  }

  private key(userId: string, dir: 'push' | 'pull', table: SyncTable): string {
    return `sync:${userId}:${dir}:${table}`;
  }

  private async run(): Promise<SyncReport> {
    const startedAt = this.o.now().toISOString();
    const tables: SyncReport['tables'] = {};
    const userId = await this.o.getUserId();
    if (!userId) return { ok: true, startedAt, finishedAt: startedAt, tables };
    try {
      await this.o.local.claimAnonymousRows(userId);
      for (const t of SYNC_ORDER) tables[t] = { pushed: await this.pushTable(userId, t), pulled: 0, applied: 0 };
      for (const t of SYNC_ORDER) {
        const { pulled, applied } = await this.pullTable(t, userId);
        (tables[t] as TableReport).pulled = pulled;
        (tables[t] as TableReport).applied = applied;
      }
      return { ok: true, startedAt, finishedAt: this.o.now().toISOString(), tables };
    } catch (e) {
      return { ok: false, startedAt, finishedAt: this.o.now().toISOString(), tables, error: errorMessage(e) };
    }
  }

  private async pushTable(userId: string, table: SyncTable): Promise<number> {
    const key = this.key(userId, 'push', table);
    const cursor = (await this.o.cursors.get(key)) || null;
    const changed = await this.o.local.changesSince(table, rewind(cursor, this.o.pushOverlapMs), userId);
    const rows: SyncRow[] = changed
      .filter((r) => isOwnedBy(r, userId) && isSyncable(table, r))
      .map((r) => toRemote(table, r, userId))
      .sort((a, b) => Date.parse(a.updated_at) - Date.parse(b.updated_at));
    let pushed = 0;
    for (const batch of chunk(rows, this.o.batchSize)) {
      await withRetry(() => this.o.remote.push(table, batch), this.o.retry);
      pushed += batch.length;
      const max = maxUpdatedAt(batch);
      // never move the cursor backwards
      if (max && (!cursor || Date.parse(max) > Date.parse(cursor))) await this.o.cursors.set(key, max);
    }
    return pushed;
  }

  private async pullTable(table: SyncTable, userId: string): Promise<{ pulled: number; applied: number }> {
    const key = this.key(userId, 'pull', table);
    const saved = parseCursor(await this.o.cursors.get(key));
    let after: PullCursor | null = saved
      ? { serverUpdatedAt: rewind(saved.serverUpdatedAt, this.o.pullOverlapMs) ?? saved.serverUpdatedAt, id: '' }
      : null;
    let pulled = 0;
    let applied = 0;
    for (;;) {
      const page = await withRetry(() => this.o.remote.pull(table, after, this.o.batchSize), this.o.retry);
      pulled += page.rows.length;
      if (page.rows.length > 0) {
        const incoming = page.rows.map((r) => fromRemote(table, r));
        const existing = await this.o.local.getByIds(
          table,
          incoming.map((r) => r.id),
        );
        const byId = new Map(existing.map((r) => [String(r.id), fromRemote(table, r as SyncRow)]));
        const toWrite: SyncRow[] = [];
        for (const r of incoming) {
          const merged = mergeRow(byId.get(r.id), r);
          if (merged) toWrite.push(merged);
        }
        if (toWrite.length > 0) await this.o.local.applyRemote(table, toWrite);
        applied += toWrite.length;
      }
      if (page.next) {
        after = page.next;
        if (!saved || Date.parse(page.next.serverUpdatedAt) >= Date.parse(saved.serverUpdatedAt)) {
          await this.o.cursors.set(key, JSON.stringify(page.next));
        }
      }
      if (!page.hasMore) break;
    }
    return { pulled, applied };
  }
}

function parseCursor(v: string | null): PullCursor | null {
  if (!v) return null;
  try {
    const c = JSON.parse(v) as Partial<PullCursor>;
    return typeof c.serverUpdatedAt === 'string' && typeof c.id === 'string' ? (c as PullCursor) : null;
  } catch {
    return null;
  }
}

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'object' && e && 'message' in e) return String((e as { message: unknown }).message);
  return String(e);
}
