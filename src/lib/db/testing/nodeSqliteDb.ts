import { migrate, type MigratableDb } from '../migrate';
import type { Repositories } from '../repositories';
import { createSqliteRepositories, type SqlDb, type SqlValue } from '../sqliteRepositories';
import { createTransactionQueue } from '../txQueue';

/**
 * TEST-ONLY helper: runs the real repository SQL against Node's built-in
 * SQLite (node >= 22.5). Not imported by app code.
 */
interface NodeStatement {
  run(...p: SqlValue[]): unknown;
  all(...p: SqlValue[]): unknown[];
  get(...p: SqlValue[]): unknown;
}
interface NodeDatabase {
  exec(sql: string): void;
  prepare(sql: string): NodeStatement;
}
type NodeDatabaseCtor = new (path: string) => NodeDatabase;

function loadNodeSqlite(): NodeDatabaseCtor | null {
  const proc = (globalThis as { process?: { getBuiltinModule?: (id: string) => unknown } }).process;
  try {
    const mod = proc?.getBuiltinModule?.('node:sqlite') as { DatabaseSync?: NodeDatabaseCtor } | undefined;
    return mod?.DatabaseSync ?? null;
  } catch {
    return null;
  }
}

export const nodeSqliteAvailable = loadNodeSqlite() !== null;

export function openNodeSqlite(): SqlDb & MigratableDb {
  const Ctor = loadNodeSqlite();
  if (!Ctor) throw new Error('node:sqlite is not available');
  const raw = new Ctor(':memory:');
  const plain = <T>(row: unknown): T => ({ ...(row as object) }) as T;
  const queue = createTransactionQueue();
  const db: SqlDb & MigratableDb = {
    async execAsync(sql) {
      raw.exec(sql);
    },
    async runAsync(sql, params) {
      return raw.prepare(sql).run(...params);
    },
    async getAllAsync<T>(sql: string, params: SqlValue[]) {
      return raw.prepare(sql).all(...params).map((r) => plain<T>(r));
    },
    async getFirstAsync<T>(sql: string, params: SqlValue[] = []) {
      const r = raw.prepare(sql).get(...params);
      return r === undefined ? null : plain<T>(r);
    },
    withExclusiveTransactionAsync(task) {
      // Same queueing as the app adapter (expoSqlDb.ts); one connection, so `tx` runs on `raw` too.
      const tx: SqlDb = { ...db, withExclusiveTransactionAsync: () => Promise.reject(new Error('Nested transaction on the local database')) };
      return queue.run(async () => {
        raw.exec('BEGIN');
        try {
          await task(tx);
          raw.exec('COMMIT');
        } catch (e) {
          raw.exec('ROLLBACK');
          throw e;
        }
      });
    },
  };
  return db;
}

/** Migrated, seeded in-memory repositories with deterministic ids and a controllable clock. */
export async function createTestRepositories(): Promise<{
  repos: Repositories;
  tick: (ms?: number) => void;
  newId: () => string;
}> {
  const db = openNodeSqlite();
  await migrate(db);
  let n = 0;
  let t = Date.parse('2026-10-15T10:00:00.000Z');
  const newId = () => `id-${++n}`;
  const repos = createSqliteRepositories(db, { newId, now: () => new Date(t).toISOString() });
  await repos.seedLibrary();
  return { repos, tick: (ms = 1000) => void (t += ms), newId };
}
