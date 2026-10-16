/**
 * Serialises write transactions on one database file.
 *
 * expo-sqlite's `withExclusiveTransactionAsync` runs the task on its own connection.
 * A second exclusive transaction that starts while the first holds the write lock fails
 * with "database is locked" (SQLITE_BUSY, a busy timeout does not help a deferred
 * transaction that already read). Several flows write at the same time (badge sync after
 * a workout, the supplement schedule, the sync engine, a CSV import), so every
 * transaction on the shared database goes through one FIFO queue. Pure; no Expo imports.
 */
export interface TransactionQueue {
  run<T>(task: () => Promise<T>): Promise<T>;
}

export function createTransactionQueue(): TransactionQueue {
  let tail: Promise<unknown> = Promise.resolve();
  return {
    run<T>(task: () => Promise<T>): Promise<T> {
      const next = tail.catch(() => undefined).then(task);
      tail = next;
      return next;
    },
  };
}
