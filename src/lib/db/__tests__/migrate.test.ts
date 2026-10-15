import { migrate, type MigratableDb } from '../migrate';
import { LATEST_SCHEMA_VERSION, migrations } from '../schema';

/** In-memory fake that records SQL and tracks PRAGMA user_version. */
function fakeDb(start = 0): MigratableDb & { executed: string[] } {
  let version = start;
  const executed: string[] = [];
  return {
    executed,
    async execAsync(sql: string) {
      executed.push(sql);
      const m = /PRAGMA user_version = (\d+)/.exec(sql);
      if (m?.[1]) version = Number(m[1]);
    },
    async getFirstAsync<T>() {
      return { user_version: version } as T;
    },
  };
}

describe('local db migrations', () => {
  it('applies all migrations on a fresh database', async () => {
    const db = fakeDb();
    await expect(migrate(db)).resolves.toBe(LATEST_SCHEMA_VERSION);
    const all = db.executed.join('\n');
    for (const table of ['exercises', 'routines', 'routine_exercises', 'workouts', 'sets']) {
      expect(all).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });

  it('is a no-op when already up to date', async () => {
    const db = fakeDb(LATEST_SCHEMA_VERSION);
    await migrate(db);
    expect(db.executed.some((s) => s.includes('CREATE TABLE'))).toBe(false);
  });

  it('has strictly increasing versions (append-only)', () => {
    migrations.forEach((m, i) => expect(m.version).toBe(i + 1));
  });
});
