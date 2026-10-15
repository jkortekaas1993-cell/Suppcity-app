import { SQLiteProvider, useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { migrate } from './migrate';
import type { Repositories } from './repositories';
import { createSqliteRepositories, type SqlDb } from './sqliteRepositories';
import { newId, nowIso } from './uuid';

export const DATABASE_NAME = 'suppcity.db';

/** expo-sqlite's SQLiteDatabase satisfies the SqlDb subset used by the repositories. */
function asSqlDb(db: SQLiteDatabase): SqlDb {
  return {
    runAsync: (sql, params) => db.runAsync(sql, params),
    getAllAsync: (sql, params) => db.getAllAsync(sql, params),
    getFirstAsync: (sql, params) => db.getFirstAsync(sql, params),
    withTransactionAsync: (task) => db.withTransactionAsync(task),
  };
}

export function createRepositories(db: SQLiteDatabase): Repositories {
  return createSqliteRepositories(asSqlDb(db), { newId, now: nowIso });
}

async function onInit(db: SQLiteDatabase) {
  await migrate(db);
  // Idempotent: only writes rows whose library data changed.
  await createRepositories(db).seedLibrary();
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
