import { createTestRepositories as setup, nodeSqliteAvailable } from '../testing/nodeSqliteDb';

/** Runs the real SQL against Node's built-in SQLite; skipped where it is unavailable. */
const maybe = nodeSqliteAvailable ? describe : describe.skip;

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
    const before = await repos.sync.changesSince('sets', null, 'u1');
    tick();
    await repos.sets.upsertMany([
      { id: 's1', workout_id: w1.id, exercise_id: 'bench-press-barbell', position: 0, set_type: 'normal', weight_kg: 80, reps: 5, rpe: null, completed_at: '2026-10-01T10:05:00.000Z' },
    ]);
    const after = await repos.sync.changesSince('sets', null, 'u1');
    expect(after.find((r) => r.id === 's1')?.updated_at).toBe(before.find((r) => r.id === 's1')?.updated_at);

    tick();
    await repos.workouts.softDelete(w1.id);
    expect(await repos.workouts.historyWithStats({ limit: 10 })).toEqual([]);
    const changed = await repos.sync.changesSince('sets', '2026-10-15T10:00:01.000Z', 'u1');
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
    const ex = await repos.sync.changesSince('exercises', null, 'u1');
    expect(ex.map((e) => e.id)).toEqual(['custom-1']);
    expect(ex[0]?.is_custom).toBe(true);
  });

  it('stores local app state and applies merged remote rows verbatim', async () => {
    const { repos } = await setup();
    await repos.appState.set('k', { a: 1 });
    expect(await repos.appState.get<{ a: number }>('k')).toEqual({ a: 1 });
    await repos.appState.remove('k');
    expect(await repos.appState.get('k')).toBeNull();

    await repos.sync.applyRemote('routines', [
      { id: 'r1', user_id: 'u1', name: 'Server', notes: null, program_slug: null, position: 0, created_at: 'x', updated_at: '2026-01-02T00:00:00.000Z', deleted_at: null, unknown_col: 1 },
    ]);
    // The engine already merged (LWW + sticky deletes): the row is written as given,
    // even with an older updated_at, and updated_at is NOT bumped.
    await repos.sync.applyRemote('routines', [
      { id: 'r1', name: 'Merged', updated_at: '2026-01-01T00:00:00.000Z', deleted_at: '2026-01-03T00:00:00.000Z' },
    ]);
    const [r1] = await repos.sync.getByIds('routines', ['r1', 'missing']);
    expect(r1).toMatchObject({ id: 'r1', name: 'Merged', updated_at: '2026-01-01T00:00:00.000Z', deleted_at: '2026-01-03T00:00:00.000Z' });
    expect(await repos.sync.getByIds('routines', ['missing'])).toEqual([]);
    expect(await repos.routines.list()).toEqual([]);
    await repos.sync.claimAnonymousRows('u2');
    await repos.appState.set('sync:u2:push:routines', 'x');
    await repos.wipeLocalData();
    expect(await repos.sync.getByIds('routines', ['r1'])).toEqual([]);
    expect(await repos.appState.get('sync:u2:push:routines')).toBeNull();
    expect(await repos.exercises.get('bench-press-barbell')).toMatchObject({ slug: 'bench-press-barbell' });
    await expect(repos.sync.changesSince('profiles', null, 'u1')).rejects.toThrow();
  });

  it('changesSince returns only own and anonymous rows; sign-out wipe leaves nothing for the next user (H1)', async () => {
    const { repos } = await setup();
    const base = { routine_id: null, started_at: '2026-10-01T10:00:00.000Z', ended_at: null, notes: null, source: 'app' as const };
    await repos.workouts.start({ ...base, title: 'anon' });
    await repos.workouts.start({ ...base, title: 'mine', user_id: 'u1' });
    await repos.workouts.start({ ...base, title: 'previous user', user_id: 'u0' });
    const titles = (await repos.sync.changesSince('workouts', null, 'u1')).map((r) => r.title).sort();
    expect(titles).toEqual(['anon', 'mine']);

    await repos.appState.set('sync:u0:pull:workouts', '{"serverUpdatedAt":"x","id":"y"}');
    await repos.wipeLocalData();
    expect(await repos.workouts.historyWithStats({ limit: 10 })).toEqual([]);
    expect(await repos.sync.changesSince('workouts', null, 'u2')).toEqual([]);
    expect(await repos.appState.get('sync:u0:pull:workouts')).toBeNull();
  });

  it('sign-out wipe keeps app_state keys with a kept prefix (local-only supplement settings)', async () => {
    const { repos } = await setup();
    await repos.appState.set('supplements.reminders@u1', { enabled: true });
    await repos.appState.set('supplements.trainingDays', 3);
    await repos.appState.set('supplementsX', 1);
    await repos.appState.set('tracker.weeklyGoal', 4);
    await repos.wipeLocalData({ keepAppStatePrefixes: ['supplements.'] });
    expect(await repos.appState.get('supplements.reminders@u1')).toEqual({ enabled: true });
    expect(await repos.appState.get('supplements.trainingDays')).toBe(3);
    expect(await repos.appState.get('supplementsX')).toBeNull();
    expect(await repos.appState.get('tracker.weeklyGoal')).toBeNull();
    await repos.wipeLocalData();
    expect(await repos.appState.get('supplements.trainingDays')).toBeNull();
  });
});
