import { SQLiteProvider, useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import type { ReactNode } from 'react';

import { migrate } from './migrate';

export const DATABASE_NAME = 'suppcity.db';

async function onInit(db: SQLiteDatabase) {
  await migrate(db);
}

/** Opens the local DB and runs migrations before rendering children. */
export function DatabaseProvider({ children }: { children: ReactNode }) {
  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={onInit}>
      {children}
    </SQLiteProvider>
  );
}

/** Raw DB handle. Features should prefer repositories over raw SQL. */
export function useDatabase(): SQLiteDatabase {
  return useSQLiteContext();
}
