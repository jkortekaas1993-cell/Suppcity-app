import type { SQLiteDatabase } from 'expo-sqlite';

import type { SqlDb } from './sqliteRepositories';
import { createTransactionQueue } from './txQueue';

/**
 * expo-sqlite 16 → the small `SqlDb` subset used by the repositories.
 *
 * Writes that must be atomic use `withExclusiveTransactionAsync`: the task gets its own
 * connection (`Transaction`), so unrelated queries on the shared connection never end up
 * inside, or get rolled back with, someone else's transaction. All transactions on the
 * file are queued (see txQueue.ts). Inside a task, a nested transaction is a bug and throws.
 */

/** Waits up to 5 s for a lock instead of failing at once with SQLITE_BUSY. */
export const BUSY_TIMEOUT_PRAGMA = 'PRAGMA busy_timeout = 5000;';

const queue = createTransactionQueue();

function txHandle(txn: SQLiteDatabase): SqlDb {
  return {
    runAsync: (sql, params) => txn.runAsync(sql, params),
    getAllAsync: (sql, params) => txn.getAllAsync(sql, params),
    getFirstAsync: (sql, params) => txn.getFirstAsync(sql, params),
    withExclusiveTransactionAsync: () => Promise.reject(new Error('Nested transaction on the local database')),
  };
}

export function expoSqlDb(db: SQLiteDatabase): SqlDb {
  return {
    runAsync: (sql, params) => db.runAsync(sql, params),
    getAllAsync: (sql, params) => db.getAllAsync(sql, params),
    getFirstAsync: (sql, params) => db.getFirstAsync(sql, params),
    withExclusiveTransactionAsync: (task) =>
      queue.run(() =>
        db.withExclusiveTransactionAsync(async (txn) => {
          // A fresh connection per transaction: give it the same lock patience.
          await txn.execAsync(BUSY_TIMEOUT_PRAGMA);
          await task(txHandle(txn));
        }),
      ),
  };
}
