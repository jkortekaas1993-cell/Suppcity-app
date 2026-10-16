import { BADGES, badgeViews, evaluateBadges, newlyEarned, type BadgeSetInput, type BadgeWorkoutInput } from '../badges';

/** Local-time noon on a given date, so week boundaries never depend on the CI time zone. */
function at(y: number, m: number, d: number, h = 12): string {
  return new Date(y, m - 1, d, h).toISOString();
}

const set = (exerciseId: string, weightKg: number, reps: number, extra: Partial<BadgeSetInput> = {}): BadgeSetInput => ({
  exerciseId,
  setType: 'normal',
  weightKg,
  reps,
  ...extra,
});

let n = 0;
function workout(startedAt: string, sets: BadgeSetInput[] = [set('curl', 10, 10)]): BadgeWorkoutInput {
  n += 1;
  const end = new Date(Date.parse(startedAt) + 3_600_000).toISOString();
  return { id: `w${String(n).padStart(3, '0')}`, startedAt, endedAt: end, sets };
}

const ids = (list: { badgeId: string }[]) => list.map((b) => b.badgeId);

describe('evaluateBadges', () => {
  it('earns nothing without workouts', () => {
    expect(evaluateBadges([], { weeklyGoal: 3 })).toEqual([]);
  });

  it('awards the first workout at the end of that workout', () => {
    const w = workout(at(2026, 10, 5));
    const out = evaluateBadges([w], { weeklyGoal: 3 });
    expect(out).toEqual([{ badgeId: 'first_workout', earnedAt: w.endedAt, sourceRef: w.id }]);
  });

  it('awards 10/50/100 workouts at the right workout, regardless of input order', () => {
    const list = Array.from({ length: 100 }, (_, i) => workout(new Date(2024, 0, 1 + i * 3, 12).toISOString()));
    const out = evaluateBadges([...list].reverse(), { weeklyGoal: 5 });
    const by = new Map(out.map((b) => [b.badgeId, b.sourceRef]));
    expect(by.get('first_workout')).toBe(list[0]?.id);
    expect(by.get('workouts_10')).toBe(list[9]?.id);
    expect(by.get('workouts_50')).toBe(list[49]?.id);
    expect(by.get('workouts_100')).toBe(list[99]?.id);
  });

  it('awards Honderd for 100 kg on the barbell bench, not on dumbbells or warm-ups', () => {
    const a = workout(at(2026, 9, 1), [set('bench-press-dumbbell', 100, 5), set('bench-press-barbell', 100, 3, { setType: 'warmup' })]);
    const b = workout(at(2026, 9, 8), [set('bench-press-barbell', 99.5, 3)]);
    const c = workout(at(2026, 9, 15), [set('bench-press-barbell', 100, 1)]);
    const out = evaluateBadges([a, b, c], { weeklyGoal: 1 });
    expect(out.find((x) => x.badgeId === 'bench_100')?.sourceRef).toBe(c.id);
  });

  it('awards squat and deadlift 100 (sumo counts as deadlift), and ignores 0 reps', () => {
    const a = workout(at(2026, 9, 1), [set('squat-barbell', 120, 0)]);
    const b = workout(at(2026, 9, 2), [set('squat-barbell', 100, 2), set('sumo-deadlift-barbell', 140, 1)]);
    const out = evaluateBadges([a, b], { weeklyGoal: 5 });
    expect(out.find((x) => x.badgeId === 'squat_100')?.sourceRef).toBe(b.id);
    expect(out.find((x) => x.badgeId === 'deadlift_100')?.sourceRef).toBe(b.id);
  });

  it('awards the first PR only when there is earlier history for the exercise', () => {
    const a = workout(at(2026, 9, 1), [set('row', 60, 8)]);
    const b = workout(at(2026, 9, 3), [set('press', 40, 8)]); // first session of press: baseline
    const c = workout(at(2026, 9, 5), [set('row', 60, 8)]); // equal, no PR
    const d = workout(at(2026, 9, 7), [set('row', 62.5, 8)]); // heavier: PR
    const out = evaluateBadges([a, b, c, d], { weeklyGoal: 5 });
    expect(out.find((x) => x.badgeId === 'first_pr')?.sourceRef).toBe(d.id);
  });

  it('awards 10 tonnes in one ISO week, summed over workouts, excluding warm-ups', () => {
    // Mon 5 Oct 2026 .. Sun 11 Oct 2026 is one ISO week.
    const a = workout(at(2026, 10, 5), [set('squat-barbell', 100, 50), set('squat-barbell', 100, 50, { setType: 'warmup' })]); // 5.000
    const b = workout(at(2026, 10, 12), [set('squat-barbell', 100, 50)]); // next week: 5.000
    const c = workout(at(2026, 10, 18), [set('squat-barbell', 100, 49)]); // same week as b: 9.900
    expect(ids(evaluateBadges([a, b, c], { weeklyGoal: 5 }))).not.toContain('volume_10t_week');
    const d = workout(at(2026, 10, 18, 18), [set('squat-barbell', 10, 10)]); // +100 = 10.000
    expect(evaluateBadges([a, b, c, d], { weeklyGoal: 5 }).find((x) => x.badgeId === 'volume_10t_week')?.sourceRef).toBe(d.id);
  });

  it('awards 4 weeks on schedule only for 4 consecutive weeks that reach the goal', () => {
    const weekOf = (mondayDay: number) => [workout(at(2026, 9, mondayDay)), workout(at(2026, 9, mondayDay + 2))];
    // Weeks starting Mon 7, 14, 21 Sep reach goal 2; week of 28 Sep has only one; then 5, 12, 19, 26 Oct.
    const list = [
      ...weekOf(7),
      ...weekOf(14),
      ...weekOf(21),
      workout(at(2026, 9, 28)),
      ...[5, 12, 19].flatMap((d) => [workout(at(2026, 10, d)), workout(at(2026, 10, d + 2))]),
    ];
    expect(ids(evaluateBadges(list, { weeklyGoal: 2 }))).not.toContain('weekly_goal_4_weeks');
    const finisher = workout(at(2026, 10, 28));
    const more = [...list, workout(at(2026, 10, 26)), finisher];
    expect(evaluateBadges(more, { weeklyGoal: 2 }).find((x) => x.badgeId === 'weekly_goal_4_weeks')?.sourceRef).toBe(finisher.id);
    // A higher goal is not reached in those weeks.
    expect(ids(evaluateBadges(more, { weeklyGoal: 3 }))).not.toContain('weekly_goal_4_weeks');
  });

  it('streaks across a year boundary', () => {
    // ISO weeks 51, 52, 53 of 2026 and week 1 of 2027 (Mondays 14, 21, 28 Dec 2026 and 4 Jan 2027).
    const list = [at(2026, 12, 14), at(2026, 12, 21), at(2026, 12, 28), at(2027, 1, 4)].map((d) => workout(d));
    const out = evaluateBadges(list, { weeklyGoal: 1 });
    expect(out.find((x) => x.badgeId === 'weekly_goal_4_weeks')?.sourceRef).toBe(list[3]?.id);
  });

  it('is deterministic and returns badges in catalogue order', () => {
    const list = [workout(at(2026, 9, 1), [set('bench-press-barbell', 100, 5)]), workout(at(2026, 9, 3), [set('bench-press-barbell', 105, 5)])];
    const one = evaluateBadges(list, { weeklyGoal: 3 });
    expect(evaluateBadges([...list].reverse(), { weeklyGoal: 3 })).toEqual(one);
    const order = BADGES.map((b) => b.id);
    expect(ids(one)).toEqual(order.filter((id) => ids(one).includes(id)));
    expect(ids(one)).toEqual(['first_workout', 'first_pr', 'bench_100']);
  });

  it('clamps an invalid weekly goal', () => {
    const w = workout(at(2026, 9, 1));
    expect(() => evaluateBadges([w], { weeklyGoal: 0 })).not.toThrow();
    expect(() => evaluateBadges([w], { weeklyGoal: Number.NaN })).not.toThrow();
  });
});

describe('newlyEarned / badgeViews', () => {
  it('only returns badges that are not stored yet', () => {
    const earned = [
      { badgeId: 'first_workout' as const, earnedAt: 'x', sourceRef: 'w1' },
      { badgeId: 'first_pr' as const, earnedAt: 'y', sourceRef: 'w2' },
    ];
    expect(ids(newlyEarned(earned, ['first_workout']))).toEqual(['first_pr']);
    expect(newlyEarned(earned, ['first_workout', 'first_pr'])).toEqual([]);
  });

  it('marks earned badges and keeps the catalogue order', () => {
    const views = badgeViews([{ badge_id: 'bench_100', earned_at: '2026-10-01T10:00:00.000Z', source_ref: 'w9' }]);
    expect(views).toHaveLength(BADGES.length);
    expect(views.filter((v) => v.earned).map((v) => v.id)).toEqual(['bench_100']);
    expect(views.find((v) => v.id === 'bench_100')).toMatchObject({ title: 'Honderd', sourceRef: 'w9' });
  });
});
