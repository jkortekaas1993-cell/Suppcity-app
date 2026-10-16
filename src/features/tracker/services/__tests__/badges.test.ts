import type { Repositories } from '@/lib/db/repositories';
import { createTestRepositories, nodeSqliteAvailable } from '@/lib/db/testing/nodeSqliteDb';

import { badgesFromWorkout, loadWeeklyGoal, saveWeeklyGoal, syncBadges, WEEKLY_GOAL_KEY } from '../badges';

const maybe = nodeSqliteAvailable ? describe : describe.skip;

async function logWorkout(repos: Repositories, id: string, startedAt: string, sets: [string, number, number][]) {
  await repos.workouts.start({ id, routine_id: null, title: id, started_at: startedAt, ended_at: null, notes: null, source: 'app' });
  await repos.sets.upsertMany(
    sets.map(([exercise, w, r], i) => ({
      id: `${id}-s${i}`,
      workout_id: id,
      exercise_id: exercise,
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

maybe('badge storage and sync', () => {
  it('stores the weekly goal clamped to 1..5 (default 3)', async () => {
    const { repos } = await createTestRepositories();
    expect(await loadWeeklyGoal(repos.appState)).toBe(3);
    expect(await saveWeeklyGoal(repos.appState, 9)).toBe(5);
    expect(await loadWeeklyGoal(repos.appState)).toBe(5);
    await repos.appState.set(WEEKLY_GOAL_KEY, 'junk');
    expect(await loadWeeklyGoal(repos.appState)).toBe(3);
  });

  it('stores newly earned badges once and reports them once', async () => {
    const { repos } = await createTestRepositories();
    await logWorkout(repos, 'w1', '2026-10-01T10:00:00.000Z', [['bench-press-barbell', 90, 5]]);
    const first = await syncBadges(repos);
    expect(first.added.map((b) => b.id)).toEqual(['first_workout']);

    await logWorkout(repos, 'w2', '2026-10-03T10:00:00.000Z', [['bench-press-barbell', 100, 3]]);
    const second = await syncBadges(repos);
    expect(second.added.map((b) => b.id)).toEqual(['first_pr', 'bench_100']);
    expect(badgesFromWorkout(second.stored, 'w2').map((b) => b.title)).toEqual(['Eerste PR', 'Honderd']);
    expect(second.stored.find((b) => b.badge_id === 'bench_100')).toMatchObject({
      earned_at: '2026-10-03T11:00:00.000Z',
      source_ref: 'w2',
      deleted_at: null,
    });

    const third = await syncBadges(repos);
    expect(third.added).toEqual([]);
    expect(third.stored).toHaveLength(3);
  });

  it('keeps earned badges when the workout is deleted, and the repository ignores duplicates', async () => {
    const { repos } = await createTestRepositories();
    await logWorkout(repos, 'w1', '2026-10-01T10:00:00.000Z', [['squat-barbell', 100, 5]]);
    await syncBadges(repos);
    await repos.workouts.softDelete('w1');
    const after = await syncBadges(repos);
    expect(after.stored.map((b) => b.badge_id).sort()).toEqual(['first_workout', 'squat_100']);
    expect(await repos.badges.addMany([{ badge_id: 'squat_100', earned_at: 'x', source_ref: null }])).toEqual([]);
  });

  it('is wiped with all other local data (account deletion / sign-out)', async () => {
    const { repos } = await createTestRepositories();
    await logWorkout(repos, 'w1', '2026-10-01T10:00:00.000Z', [['bench-press-barbell', 60, 5]]);
    await syncBadges(repos);
    await saveWeeklyGoal(repos.appState, 4);
    await repos.wipeLocalData();
    expect(await repos.badges.list()).toEqual([]);
    expect(await loadWeeklyGoal(repos.appState)).toBe(3);
  });
});
