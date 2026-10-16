import { migrate } from '@/lib/db/migrate';
import { createSqliteRepositories } from '@/lib/db/sqliteRepositories';
import { nodeSqliteAvailable, openNodeSqlite } from '@/lib/db/testing/nodeSqliteDb';

import { loadExerciseSessions, loadTopExercise, loadWeekSummary } from '../loaders';
import { exerciseOptions } from '../queries';

/** Runs the read-only progress SQL against the real schema in Node's SQLite. */
const maybe = nodeSqliteAvailable ? describe : describe.skip;

async function setup() {
  const db = openNodeSqlite();
  await migrate(db);
  let n = 0;
  const repos = createSqliteRepositories(db, { newId: () => `id-${++n}`, now: () => '2026-10-16T10:00:00.000Z' });
  await repos.seedLibrary();

  const workout = async (startedAt: Date, sets: [string, number, number, ('normal' | 'warmup')?][], finished = true) => {
    const w = await repos.workouts.start({
      routine_id: null, title: 'T', started_at: startedAt.toISOString(), ended_at: null, notes: null, source: 'app',
    });
    await repos.sets.upsertMany(
      sets.map(([exercise_id, weight_kg, reps, set_type = 'normal'], position) => ({
        id: `${w.id}-s${position}`, workout_id: w.id, exercise_id, position, set_type, weight_kg, reps, rpe: null,
        completed_at: startedAt.toISOString(),
      })),
    );
    if (finished) await repos.workouts.finish(w.id, new Date(startedAt.getTime() + 60 * 60_000).toISOString());
    return w.id;
  };
  return { db, repos, workout };
}

maybe('progress queries', () => {
  const now = new Date(2026, 9, 16, 12);

  it('reads exercise history: finished, completed, not deleted, own rows only', async () => {
    const { db, repos, workout } = await setup();
    await workout(new Date(2026, 8, 1, 18), [['bench-press-barbell', 40, 10, 'warmup'], ['bench-press-barbell', 80, 5]]);
    await workout(new Date(2026, 9, 1, 18), [['bench-press-barbell', 85, 5], ['squat-barbell', 100, 5]]);
    await workout(new Date(2026, 9, 14, 18), [['bench-press-barbell', 87.5, 5]]);
    await workout(new Date(2026, 9, 15, 18), [['bench-press-barbell', 200, 1]], false); // unfinished
    const deleted = await workout(new Date(2026, 9, 10, 18), [['bench-press-barbell', 150, 1]]);
    await repos.workouts.softDelete(deleted);
    const foreign = await workout(new Date(2026, 9, 11, 18), [['bench-press-barbell', 300, 1]]);
    await db.runAsync(`UPDATE workouts SET user_id = 'someone-else' WHERE id = ?`, [foreign]);

    const options = await exerciseOptions(db, 'me');
    expect(options.map((o) => [o.id, o.workouts])).toEqual([
      ['bench-press-barbell', 3],
      ['squat-barbell', 1],
    ]);
    expect(options[0]?.name).toBeTruthy();

    const sessions = await loadExerciseSessions(db, 'bench-press-barbell', 'me');
    expect(sessions.map((s) => s.heaviest?.weightKg)).toEqual([80, 85, 87.5]);
    expect(sessions.map((s) => s.pr)).toEqual([false, true, true]);

    // Signed out: no owner filter (sign-out wipes local data), so the foreign row shows.
    expect((await loadExerciseSessions(db, 'bench-press-barbell', null)).length).toBe(4);

    const top = await loadTopExercise(db, 'me');
    expect(top?.exercise.id).toBe('bench-press-barbell');
  });

  it('summarises this week vs. last week with muscle groups', async () => {
    const { db, workout } = await setup();
    await workout(new Date(2026, 9, 6, 18), [['bench-press-barbell', 80, 5]]);
    await workout(new Date(2026, 9, 13, 18), [['bench-press-barbell', 80, 5], ['squat-barbell', 100, 5], ['squat-barbell', 60, 5, 'warmup']]);
    await workout(new Date(2026, 9, 3, 18), [['squat-barbell', 100, 5]]); // two weeks ago

    const week = await loadWeekSummary(db, null, now);
    expect(week.current).toMatchObject({ workouts: 1, sets: 2, volumeKg: 900, durationMin: 60 });
    expect(week.previous).toMatchObject({ workouts: 1, sets: 1, volumeKg: 400 });
    expect(week.muscles.find((m) => m.muscle === 'borst')?.sets).toBe(1);
    expect(week.muscles.find((m) => m.muscle === 'quadriceps')?.sets).toBe(1);
    expect(week.muscles.find((m) => m.muscle === 'triceps')?.sets).toBe(0.5);
  });

  it('returns nothing without history', async () => {
    const { db } = await setup();
    expect(await loadTopExercise(db, null)).toBeNull();
    const week = await loadWeekSummary(db, null, now);
    expect(week.current.workouts).toBe(0);
    expect(week.muscles).toEqual([]);
  });
});
