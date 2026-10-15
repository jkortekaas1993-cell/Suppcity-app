import { migrations as allMigrations, type Migration } from './schema';

/** The subset of expo-sqlite's SQLiteDatabase we depend on (keeps this testable in Node). */
export interface MigratableDb {
  execAsync(sql: string): Promise<void>;
  getFirstAsync<T>(sql: string): Promise<T | null>;
}

/**
 * Applies pending migrations using PRAGMA user_version. Each migration runs in
 * its own transaction. Migrations are append-only: never edit a shipped one.
 */
export async function migrate(db: MigratableDb, migrations: Migration[] = allMigrations): Promise<number> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let current = row?.user_version ?? 0;

  const pending = [...migrations].sort((a, b) => a.version - b.version).filter((m) => m.version > current);
  for (const m of pending) {
    await db.execAsync('BEGIN;');
    try {
      await db.execAsync(m.sql);
      await db.execAsync(`PRAGMA user_version = ${m.version};`);
      await db.execAsync('COMMIT;');
    } catch (err) {
      await db.execAsync('ROLLBACK;');
      throw new Error(`Local migration ${m.version} (${m.name}) failed: ${String(err)}`);
    }
    current = m.version;
  }
  return current;
}
