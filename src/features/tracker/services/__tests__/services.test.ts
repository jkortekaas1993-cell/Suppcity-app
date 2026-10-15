import type { Repositories } from '@/lib/db/repositories';
import { createTestRepositories, nodeSqliteAvailable } from '@/lib/db/testing/nodeSqliteDb';

import { exportAllCsv, importWorkoutCsv } from '../dataPort';
import { addProgramAsRoutines } from '../programs';
import { buildWorkoutReport } from '../workoutSummary';

const maybe = nodeSqliteAvailable ? describe : describe.skip;

async function logWorkout(repos: Repositories, id: string, startedAt: string, sets: [number, number][]) {
  await repos.workouts.start({ id, routine_id: null, title: id, started_at: startedAt, ended_at: null, notes: null, source: 'app' });
  await repos.sets.upsertMany(
    sets.map(([w, r], i) => ({
      id: `${id}-s${i}`,
      workout_id: id,
      exercise_id: 'bench-press-barbell',
      position: i,
      set_type: 'normal' as const,
      weight_kg: w,
      reps: r,
      rpe: null,
      completed_at: startedAt,
    })),
  );
  await repos.workouts.finish(id, new Date(Date.parse(startedAt) + 3_600_000).toISOString());
}

maybe('tracker services', () => {
  it('reports summary and PRs against earlier workouts only', async () => {
    const { repos } = await createTestRepositories();
    await logWorkout(repos, 'w1', '2026-10-01T10:00:00.000Z', [[80, 5], [80, 5]]);
    await logWorkout(repos, 'w2', '2026-10-03T10:00:00.000Z', [[85, 5], [85, 5]]);
    const r1 = await buildWorkoutReport(repos, 'w1');
    expect(r1?.prs).toEqual([]);
    const r2 = await buildWorkoutReport(repos, 'w2');
    expect(r2?.summary).toMatchObject({ durationMs: 3_600_000, volumeKg: 850, completedSets: 2 });
    expect(r2?.prs.map((p) => p.kind).sort()).toEqual(['best_e1rm', 'best_volume', 'heaviest_weight']);
    expect(r2?.prs[0]?.exerciseName).toBe('Bankdrukken (halter)');
  });

  it('adds a program as ordered routines', async () => {
    const { repos } = await createTestRepositories();
    await addProgramAsRoutines(repos, 'full-body-3x');
    await addProgramAsRoutines(repos, 'upper-lower');
    const list = await repos.routines.list();
    expect(list.map((r) => r.position)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(list[2]?.program_slug).toBe('upper-lower');
    const first = await repos.routines.get(list[0]?.id ?? '');
    expect(first?.exercises[0]).toMatchObject({ exercise_id: 'squat-barbell', target_sets: 3, rest_seconds: 150 });
  });

  it('imports a Hevy CSV, creates unknown exercises and round-trips export', async () => {
    const { repos, newId } = await createTestRepositories();
    const csv = [
      'title,start_time,end_time,description,exercise_title,set_index,set_type,weight_kg,reps,rpe',
      'Push,26 Jan 2024 18:05,26 Jan 2024 19:00,,Bench Press (Barbell),0,normal,80,5,',
      'Push,26 Jan 2024 18:05,26 Jan 2024 19:00,,Zercher Carry,0,normal,60,1,',
      'Push,26 Jan 2024 18:05,26 Jan 2024 19:00,,zercher carry,1,normal,60,1,',
    ].join('\n');
    const res = await importWorkoutCsv(repos, csv, newId);
    expect(res).toMatchObject({ format: 'hevy', imported: 1, skipped: 0, createdExercises: ['Zercher Carry'] });
    const again = await importWorkoutCsv(repos, csv, newId);
    expect(again.imported).toBe(0);
    expect(again.createdExercises).toEqual([]); // now matched by Dutch name of the custom exercise

    const out = await exportAllCsv(repos);
    expect(out.rows).toBe(3);
    const lines = out.csv.trim().split('\r\n');
    expect(lines[1]).toContain('Bankdrukken (halter)');
    expect(lines[3]).toContain(',1,normal,60,1,'); // set_index restarts per exercise
  });
});
