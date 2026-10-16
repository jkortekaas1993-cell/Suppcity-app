import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { useMemo, useSyncExternalStore } from 'react';

import { DATABASE_NAME, newId, nowIso, useDatabase, type SqlDb } from '@/lib/db';

import { createSupplementRepository, type SupplementRepository } from '../data/supplementRepository';

/** expo-sqlite's SQLiteDatabase → the small SqlDb subset the repository uses. */
export function asSqlDb(db: SQLiteDatabase): SqlDb {
  return {
    runAsync: (sql, params) => db.runAsync(sql, params),
    getAllAsync: (sql, params) => db.getAllAsync(sql, params),
    getFirstAsync: (sql, params) => db.getFirstAsync(sql, params),
    withTransactionAsync: (task) => db.withTransactionAsync(task),
  };
}

export function repositoryFor(db: SqlDb): SupplementRepository {
  return createSupplementRepository(db, { newId, now: nowIso });
}

let shared: Promise<SupplementRepository> | null = null;

/**
 * Repository for code outside React (app start, notification actions, wipe, export).
 * Opens its own connection to the same database file; call it only after
 * <DatabaseProvider> has run the migrations.
 */
export function sharedRepository(db?: SqlDb): Promise<SupplementRepository> {
  if (db) return Promise.resolve(repositoryFor(db));
  shared ??= openDatabaseAsync(DATABASE_NAME)
    .then((raw) => repositoryFor(asSqlDb(raw)))
    .catch((e: unknown) => {
      shared = null;
      throw e;
    });
  return shared;
}

/** Repository on the provider's connection, for screens. */
export function useSupplementRepository(): SupplementRepository {
  const db = useDatabase();
  return useMemo(() => repositoryFor(asSqlDb(db)), [db]);
}

// --- change signal: screens and the Vandaag card reload after any write ------------

let version = 0;
const listeners = new Set<() => void>();

export function notifySupplementsChanged(): void {
  version += 1;
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Increments after every supplement write (in-app or from a notification action). */
export function useSupplementsVersion(): number {
  return useSyncExternalStore(subscribe, () => version, () => version);
}
