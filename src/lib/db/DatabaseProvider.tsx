import { SQLiteProvider, useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { expoSqlDb } from './expoSqlDb';
import { migrate } from './migrate';
import type { Repositories } from './repositories';
import { createSqliteRepositories, type SqlDb } from './sqliteRepositories';
import { newId, nowIso } from './uuid';

export const DATABASE_NAME = 'suppcity.db';

export function createRepositories(db: SQLiteDatabase): Repositories {
  return createSqliteRepositories(expoSqlDb(db), { newId, now: nowIso });
}

// The ONE app connection (the provider's), for code outside React: app start, notification
// actions, wipe and export. Nobody opens a second connection to the database file.
let resolveShared: ((db: SqlDb) => void) | null = null;
let sharedDb: Promise<SqlDb> = new Promise((resolve) => (resolveShared = resolve));

async function onInit(db: SQLiteDatabase) {
  await migrate(db);
  // Idempotent: only writes rows whose library data changed.
  await createRepositories(db).seedLibrary();
  const handle = expoSqlDb(db);
  if (resolveShared) {
    resolveShared(handle);
    resolveShared = null;
  } else {
    sharedDb = Promise.resolve(handle); // provider re-mounted (fast refresh)
  }
}

/** The provider's connection as `SqlDb`; resolves once migrations and seeding are done. */
export function getSharedDatabase(): Promise<SqlDb> {
  return sharedDb;
}

const RepositoriesContext = createContext<Repositories | null>(null);

function RepositoriesProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const repos = useMemo(() => createRepositories(db), [db]);
  return <RepositoriesContext.Provider value={repos}>{children}</RepositoriesContext.Provider>;
}

/** Opens the local DB, runs migrations and seeds the library before rendering children. */
export function DatabaseProvider({ children }: { children: ReactNode }) {
  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={onInit}>
      <RepositoriesProvider>{children}</RepositoriesProvider>
    </SQLiteProvider>
  );
}

/** Raw DB handle. Features should prefer repositories over raw SQL. */
export function useDatabase(): SQLiteDatabase {
  return useSQLiteContext();
}

/** Repository layer for features and screens. */
export function useRepositories(): Repositories {
  const repos = useContext(RepositoriesContext);
  if (!repos) throw new Error('useRepositories must be used inside <DatabaseProvider>');
  return repos;
}
