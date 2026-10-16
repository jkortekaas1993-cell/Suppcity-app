import type { Repositories } from '@/lib/db/repositories';
import { createTestRepositories, nodeSqliteAvailable } from '@/lib/db/testing/nodeSqliteDb';

import {
  BADGE_CACHE_KEY,
  badgesFromWorkout,
  loadWeeklyGoal,
  loadWeeklyGoalHistory,
  saveWeeklyGoal,
  syncBadges,
  WEEKLY_GOAL_KEY,
} from '../badges';
import { exportMilestonesCsv } from '../dataPort';

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

  it('only re-evaluates the history after training data or the goal changed (review M5)', async () => {
    const { repos, tick } = await createTestRepositories();
    let reads = 0;
    const counted = { ...repos, dataPort: { ...repos.dataPort, exportRows: () => (reads++, repos.dataPort.exportRows()) } };
    await logWorkout(repos, 'w1', '2026-10-01T10:00:00.000Z', [['bench-press-barbell', 60, 5]]);
    await syncBadges(counted);
    await syncBadges(counted);
    await syncBadges(counted);
    expect(reads).toBe(1);

    await logWorkout(repos, 'w2', '2026-10-02T10:00:00.000Z', [['bench-press-barbell', 100, 1]]);
    const after = await syncBadges(counted);
    expect(reads).toBe(2);
    expect(after.added.map((b) => b.id)).toContain('bench_100');

    tick();
    await repos.sets.update('w2-s0', { reps: 2 }); // an edit
    await syncBadges(counted);
    expect(reads).toBe(3);

    await saveWeeklyGoal(repos.appState, 4, new Date('2026-10-14T12:00:00'));
    await syncBadges(counted);
    expect(reads).toBe(4);

    await syncBadges(counted, { force: true });
    expect(reads).toBe(5);
    expect(await repos.appState.get(BADGE_CACHE_KEY)).not.toBeNull();
  });

  it('records the weekly goal per ISO week; changing it never rewrites past weeks (review L7)', async () => {
    const { repos } = await createTestRepositories();
    // Goal 2 (set before any of these weeks), 4 workouts-weeks of 2 trainings each.
    await saveWeeklyGoal(repos.appState, 2, new Date('2026-09-01T12:00:00'));
    const weeks = ['2026-09-07', '2026-09-14', '2026-09-21'];
    for (const [i, d] of weeks.entries()) {
      await logWorkout(repos, `a${i}`, `${d}T10:00:00`, [['squat-barbell', 50, 5]]);
      await logWorkout(repos, `b${i}`, `${d.slice(0, 8)}${String(Number(d.slice(8)) + 1).padStart(2, '0')}T10:00:00`, [['squat-barbell', 50, 5]]);
    }
    // Week 4: the user raises the goal to 5 BEFORE finishing the week with 2 workouts.
    await saveWeeklyGoal(repos.appState, 5, new Date('2026-09-28T08:00:00'));
    await logWorkout(repos, 'a3', '2026-09-28T10:00:00', [['squat-barbell', 50, 5]]);
    await logWorkout(repos, 'b3', '2026-09-29T10:00:00', [['squat-barbell', 50, 5]]);
    const r1 = await syncBadges(repos);
    // Week 4 counts against 5, so no streak yet; the 3 earlier weeks keep goal 2.
    expect(r1.stored.map((b) => b.badge_id)).not.toContain('weekly_goal_4_weeks');

    // Lowering the goal later must not make the old weeks count retroactively either.
    await saveWeeklyGoal(repos.appState, 1, new Date('2026-10-12T08:00:00'));
    const r2 = await syncBadges(repos);
    expect(r2.stored.map((b) => b.badge_id)).not.toContain('weekly_goal_4_weeks');

    const history = await loadWeeklyGoalHistory(repos.appState);
    expect(history.map((h) => [h.key, h.goal])).toEqual([
      ['', 3],
      ['2026-W36', 2],
      ['2026-W40', 5],
      ['2026-W42', 1],
    ]);
    expect(history[2]?.from).toBe('2026-09-28');

    // Changing twice in the same week keeps one entry for that week.
    await saveWeeklyGoal(repos.appState, 3, new Date('2026-10-13T08:00:00'));
    expect((await loadWeeklyGoalHistory(repos.appState)).map((h) => h.goal)).toEqual([3, 2, 5, 3]);
  });
});

maybe('CSV export of milestones and weekly goal (hard rule 9)', () => {
  it('exports earned badges and the goal per week', async () => {
    const { repos } = await createTestRepositories();
    let files = await exportMilestonesCsv(repos);
    expect(files.map((f) => f.fileName)).toEqual(['suppcity-mijlpalen.csv', 'suppcity-weekdoel.csv']);
    expect(files[1]?.csv.trim().split(/\r?\n/)).toEqual(['valid_from_week,valid_from_date,weekly_goal,current', ',,3,ja']);

    await logWorkout(repos, 'w1', '2026-10-01T10:00:00.000Z', [['bench-press-barbell', 100, 1]]);
    await syncBadges(repos);
    await saveWeeklyGoal(repos.appState, 4, new Date('2026-10-14T12:00:00'));
    files = await exportMilestonesCsv(repos);
    const badgeLines = files[0]!.csv.trim().split(/\r?\n/);
    expect(badgeLines[0]).toBe('badge_id,title,description,earned_at,workout_id');
    expect(badgeLines.slice(1)).toEqual([
      'bench_100,Honderd,Eerste keer 100 kg op de bank,2026-10-01T11:00:00.000Z,w1',
      'first_workout,Eerste workout,Je eerste training afgerond,2026-10-01T11:00:00.000Z,w1',
    ]);
    expect(files[1]!.csv.trim().split(/\r?\n/).slice(1)).toEqual([',,3,nee', '2026-W42,2026-10-12,4,ja']);
  });
});
