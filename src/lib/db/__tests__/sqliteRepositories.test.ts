import { migrate } from '../migrate';
import type { Repositories } from '../repositories';
import { createSqliteRepositories, type SqlDb, type SqlValue } from '../sqliteRepositories';

/**
 * Runs the real SQL against Node's built-in SQLite (node >= 22.5). Skipped
 * when `node:sqlite` is not available in the test runtime.
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

function loadNodeSqlite(): (new (path: string) => NodeDatabase) | null {
  const proc = (globalThis as { process?: { getBuiltinModule?: (id: string) => unknown } }).process;
  try {
    const mod = proc?.getBuiltinModule?.('node:sqlite') as { DatabaseSync?: new (path: string) => NodeDatabase } | undefined;
    return mod?.DatabaseSync ?? null;
  } catch {
    return null;
  }
}

const DatabaseSync = loadNodeSqlite();
const maybe = DatabaseSync ? describe : describe.skip;

function adapter(raw: NodeDatabase): SqlDb & {
  execAsync(sql: string): Promise<void>;
  getFirstAsync<T>(sql: string, params?: SqlValue[]): Promise<T | null>;
} {
  const plain = <T>(row: unknown): T => ({ ...(row as object) }) as T;
  return {
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
    async withTransactionAsync(task) {
      raw.exec('BEGIN');
      try {
        await task();
        raw.exec('COMMIT');
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    },
  };
}

async function setup(): Promise<{ repos: Repositories; tick: () => void }> {
  if (!DatabaseSync) throw new Error('unreachable');
  const db = adapter(new DatabaseSync(':memory:'));
  await migrate(db);
  let n = 0;
  let t = Date.parse('2026-10-15T10:00:00.000Z');
  const repos = createSqliteRepositories(db, {
    newId: () => `id-${++n}`,
    now: () => new Date(t).toISOString(),
  });
  await repos.seedLibrary();
  return { repos, tick: () => (t += 1000) };
}

maybe('sqlite repositories', () => {
  it('seeds the library idempotently and lists by muscle', async () => {
    const { repos } = await setup();
    await repos.seedLibrary();
    const borst = await repos.exercises.list({ muscle: 'borst' });
    expect(borst.length).toBeGreaterThan(5);
    const bench = await repos.exercises.get('bench-press-barbell');
    expect(bench).toMatchObject({ is_custom: false, slug: 'bench-press-barbell' });
    expect(bench?.secondary_muscles).toEqual(['triceps', 'schouders']);
  });

  it('logs a workout, finds "vorige keer" and PRs, and soft-deletes', async () => {
    const { repos, tick } = await setup();
    const w1 = await repos.workouts.start({
      routine_id: null, title: 'A', started_at: '2026-10-01T10:00:00.000Z', ended_at: null, notes: null, source: 'app',
    });
    await repos.sets.upsertMany([
      { id: 's1', workout_id: w1.id, exercise_id: 'bench-press-barbell', position: 0, set_type: 'normal', weight_kg: 80, reps: 5, rpe: null, completed_at: '2026-10-01T10:05:00.000Z' },
      { id: 's2', workout_id: w1.id, exercise_id: 'bench-press-barbell', position: 1, set_type: 'normal', weight_kg: 85, reps: 3, rpe: null, completed_at: '2026-10-01T10:08:00.000Z' },
      { id: 's3', workout_id: w1.id, exercise_id: 'bench-press-barbell', position: 2, set_type: 'normal', weight_kg: 90, reps: 1, rpe: null, completed_at: null },
    ]);
    // Unfinished workouts are not "vorige keer".
    expect(await repos.sets.previousFor('bench-press-barbell')).toBeNull();
    await repos.workouts.finish(w1.id, '2026-10-01T11:00:00.000Z');

    const prev = await repos.sets.previousFor('bench-press-barbell', 'other');
    expect(prev?.sets.map((s) => [s.weight_kg, s.reps])).toEqual([[80, 5], [85, 3]]);

    const pr = await repos.sets.personalRecords('bench-press-barbell');
    expect(pr.heaviest?.weight_kg).toBe(85);
    expect(pr.bestE1rm).toBeCloseTo(93.5, 5); // 85 × (1 + 3/30) beats 80 × (1 + 5/30)

    const list = await repos.workouts.historyWithStats({ limit: 10 });
    expect(list[0]).toMatchObject({ id: w1.id, set_count: 2, volume_kg: 655, exercise_count: 1 });

    // Upsert is a no-op when nothing changed (updated_at stays put).
    const before = await repos.sync.changesSince('sets', null);
    tick();
    await repos.sets.upsertMany([
      { id: 's1', workout_id: w1.id, exercise_id: 'bench-press-barbell', position: 0, set_type: 'normal', weight_kg: 80, reps: 5, rpe: null, completed_at: '2026-10-01T10:05:00.000Z' },
    ]);
    const after = await repos.sync.changesSince('sets', null);
    expect(after.find((r) => r.id === 's1')?.updated_at).toBe(before.find((r) => r.id === 's1')?.updated_at);

    tick();
    await repos.workouts.softDelete(w1.id);
    expect(await repos.workouts.historyWithStats({ limit: 10 })).toEqual([]);
    const changed = await repos.sync.changesSince('sets', '2026-10-15T10:00:01.000Z');
    expect(changed.every((r) => r.deleted_at !== null)).toBe(true);
    expect(changed).toHaveLength(3);
  });

  it('creates routines and replaces their exercises with soft deletes', async () => {
    const { repos } = await setup();
    const r = await repos.routines.create(
      { name: 'Push', notes: null, program_slug: null, position: 0 },
      [{ routine_id: '', exercise_id: 'bench-press-barbell', position: 0, target_sets: 3, target_reps_min: 5, target_reps_max: 8, rest_seconds: 120 }],
    );
    await repos.routines.replaceExercises(r.id, [
      { routine_id: r.id, exercise_id: 'push-up', position: 0, target_sets: 2, target_reps_min: null, target_reps_max: null, rest_seconds: 60 },
    ]);
    const got = await repos.routines.get(r.id);
    expect(got?.exercises.map((e) => e.exercise_id)).toEqual(['push-up']);
    expect(await repos.routines.maxPosition()).toBe(0);
    await repos.routines.softDelete(r.id);
    expect(await repos.routines.list()).toEqual([]);
  });

  it('imports workouts once and exports them', async () => {
    const { repos } = await setup();
    const input = {
      newExercises: [{ id: 'custom-1', slug: null, name_nl: 'Zercher Carry', primary_muscle: 'full_body' as const, secondary_muscles: [], equipment: 'other' as const, is_custom: true }],
      workouts: [
        {
          workout: { routine_id: null, title: 'Oud', started_at: '2024-01-26T17:05:00.000Z', ended_at: '2024-01-26T18:10:00.000Z', notes: null, source: 'import_hevy' as const },
          sets: [
            { exercise_id: 'bench-press-barbell', position: 0, set_type: 'normal' as const, weight_kg: 80, reps: 5, rpe: 8, completed_at: '2024-01-26T18:10:00.000Z' },
            { exercise_id: 'custom-1', position: 1, set_type: 'normal' as const, weight_kg: 60, reps: null, rpe: null, completed_at: '2024-01-26T18:10:00.000Z' },
          ],
        },
      ],
    };
    expect(await repos.dataPort.importWorkouts(input)).toEqual({ imported: 1, skipped: 0 });
    expect(await repos.dataPort.importWorkouts({ ...input, newExercises: [] })).toEqual({ imported: 0, skipped: 1 });
    const rows = await repos.dataPort.exportRows();
    expect(rows.map((r) => [r.exercise_name, r.weight_kg])).toEqual([['Bankdrukken (halter)', 80], ['Zercher Carry', 60]]);
    // Only custom exercises are offered to sync.
    const ex = await repos.sync.changesSince('exercises', null);
    expect(ex.map((e) => e.id)).toEqual(['custom-1']);
    expect(ex[0]?.is_custom).toBe(true);
  });

  it('stores local app state and applies remote rows last-write-wins', async () => {
    const { repos } = await setup();
    await repos.appState.set('k', { a: 1 });
    expect(await repos.appState.get<{ a: number }>('k')).toEqual({ a: 1 });
    await repos.appState.remove('k');
    expect(await repos.appState.get('k')).toBeNull();

    await repos.sync.applyRemote('routines', [
      { id: 'r1', user_id: 'u1', name: 'Server', notes: null, program_slug: null, position: 0, created_at: 'x', updated_at: '2026-01-02T00:00:00.000Z', deleted_at: null, unknown_col: 1 },
    ]);
    await repos.sync.applyRemote('routines', [
      { id: 'r1', name: 'Older', updated_at: '2026-01-01T00:00:00.000Z' },
    ]);
    expect((await repos.routines.list())[0]?.name).toBe('Server');
    await repos.sync.claimAnonymousRows('u2');
    await expect(repos.sync.changesSince('profiles', null)).rejects.toThrow();
  });
});
