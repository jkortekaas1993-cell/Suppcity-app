import { CLAIMS, getApprovedClaim } from '@/content/claims';
import { EXERCISES_NL } from '@/content/exercises.nl';
import { PROGRAMS } from '@/content/programs';
import { pointsForOrder, workoutPointsAvailable } from '@/features/points/rules';
import { formatElapsed } from '@/features/tracker/ActiveWorkoutBar';
import { parseEnv } from '@/lib/config/env';
import { migrate, type MigratableDb } from '@/lib/db/migrate';
import { LATEST_SCHEMA_VERSION, migrations } from '@/lib/db/schema';

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

  it('has strictly increasing versions', () => {
    migrations.forEach((m, i) => expect(m.version).toBe(i + 1));
  });
});

describe('points rules (hard rule 5)', () => {
  it('awards whole euros only', () => {
    expect(pointsForOrder(49.99)).toBe(49);
    expect(pointsForOrder(-5)).toBe(0);
    expect(pointsForOrder(Number.NaN)).toBe(0);
  });

  it('caps rewarded workouts per week', () => {
    expect(workoutPointsAvailable(2)).toBeGreaterThan(0);
    expect(workoutPointsAvailable(3)).toBe(0);
  });
});

describe('content integrity', () => {
  it('does not render unapproved claims (hard rule 4)', () => {
    for (const claim of Object.values(CLAIMS)) {
      if (!claim.approvedAt) expect(getApprovedClaim(claim.id)).toBeNull();
    }
  });

  it('programs only reference known exercise slugs', () => {
    const slugs = new Set(EXERCISES_NL.map((e) => e.slug));
    expect(slugs.size).toBe(EXERCISES_NL.length);
    for (const p of PROGRAMS) {
      for (const d of p.days) for (const e of d.exercises) expect(slugs.has(e.slug)).toBe(true);
    }
  });
});

describe('misc', () => {
  it('formats elapsed time', () => {
    expect(formatElapsed(65_000)).toBe('1:05');
    expect(formatElapsed(3_725_000)).toBe('1:02:05');
  });

  it('rejects incomplete env config', () => {
    expect(() => parseEnv({})).toThrow(/Invalid app config/);
  });
});
