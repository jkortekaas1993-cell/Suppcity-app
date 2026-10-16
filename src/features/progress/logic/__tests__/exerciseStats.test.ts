import {
  buildSessions,
  epley1rm,
  filterByPeriod,
  monthLabels,
  periodStart,
  summarizeExercise,
  trendSentence,
  type ExerciseSetRow,
} from '../exerciseStats';

const row = (workout_id: string, started_at: string, weight_kg: number | null, reps: number | null, set_type: ExerciseSetRow['set_type'] = 'normal'): ExerciseSetRow => ({
  workout_id,
  started_at,
  weight_kg,
  reps,
  set_type,
});

describe('epley1rm', () => {
  it('uses w × (1 + reps/30) and returns the weight for a single', () => {
    expect(epley1rm(100, 1)).toBe(100);
    expect(epley1rm(100, 3)).toBeCloseTo(110, 6);
    expect(epley1rm(90, 10)).toBeCloseTo(120, 6);
  });
  it('only counts 1–10 reps with a positive weight', () => {
    expect(epley1rm(60, 11)).toBeNull();
    expect(epley1rm(60, 0)).toBeNull();
    expect(epley1rm(0, 5)).toBeNull();
    expect(epley1rm(null, 5)).toBeNull();
    expect(epley1rm(60, 2.5)).toBeNull();
  });
});

describe('buildSessions', () => {
  const rows: ExerciseSetRow[] = [
    row('w1', '2026-05-01T10:00:00.000Z', 60, 10, 'warmup'),
    row('w1', '2026-05-01T10:00:00.000Z', 80, 5),
    row('w1', '2026-05-01T10:00:00.000Z', 80, 5),
    row('w2', '2026-06-01T10:00:00.000Z', 85, 5),
    row('w2', '2026-06-01T10:00:00.000Z', 40, 15), // >10 reps: volume yes, e1RM no
    row('w3', '2026-07-01T10:00:00.000Z', 82.5, 5),
    row('w4', '2026-08-01T10:00:00.000Z', 120, 1, 'warmup'), // warm-up only: dropped
    row('w5', '2026-09-01T10:00:00.000Z', 30, 20), // no e1RM-eligible set
  ];
  const sessions = buildSessions(rows);

  it('groups per workout, oldest first, without warm-ups', () => {
    expect(sessions.map((s) => s.workoutId)).toEqual(['w1', 'w2', 'w3', 'w5']);
    expect(sessions[0]?.volumeKg).toBe(800);
    expect(sessions[0]?.heaviest).toEqual({ weightKg: 80, reps: 5 });
    expect(sessions[1]?.volumeKg).toBe(85 * 5 + 40 * 15);
  });
  it('estimates e1RM from 1–10 rep sets only', () => {
    expect(sessions[1]?.e1rm).toBeCloseTo(85 * (1 + 5 / 30), 6);
    expect(sessions[3]?.e1rm).toBeNull();
  });
  it('marks a session as PR only when it beats every earlier session', () => {
    expect(sessions.map((s) => s.pr)).toEqual([false, true, false, false]);
  });
  it('heaviest set prefers weight, then reps', () => {
    const s = buildSessions([row('a', '2026-01-01T00:00:00Z', 100, 2), row('a', '2026-01-01T00:00:00Z', 100, 3), row('a', '2026-01-01T00:00:00Z', 90, 8)]);
    expect(s[0]?.heaviest).toEqual({ weightKg: 100, reps: 3 });
  });
});

describe('periods and summary', () => {
  const now = new Date(2026, 9, 16, 12, 0, 0);
  const sessions = buildSessions([
    row('old', new Date(2025, 9, 1).toISOString(), 70, 5),
    row('a', new Date(2026, 5, 1).toISOString(), 80, 5),
    row('b', new Date(2026, 7, 1).toISOString(), 90, 3),
    row('c', new Date(2026, 9, 1).toISOString(), 85, 8),
  ]);

  it('periodStart goes back whole months; "all" has no start', () => {
    expect(periodStart('3m', now)?.getMonth()).toBe(6);
    expect(periodStart('1y', now)?.getFullYear()).toBe(2025);
    expect(periodStart('all', now)).toBeNull();
  });
  it('filters sessions by period', () => {
    expect(filterByPeriod(sessions, '6m', now).map((s) => s.workoutId)).toEqual(['a', 'b', 'c']);
    expect(filterByPeriod(sessions, '3m', now).map((s) => s.workoutId)).toEqual(['b', 'c']);
    expect(filterByPeriod(sessions, 'all', now)).toHaveLength(4);
  });
  it('summarises latest e1RM, delta, heaviest set, best volume and PRs', () => {
    const sum = summarizeExercise(filterByPeriod(sessions, '6m', now));
    expect(sum.latestE1rm).toBeCloseTo(85 * (1 + 8 / 30), 6);
    expect(sum.deltaE1rm).toBeCloseTo(85 * (1 + 8 / 30) - 80 * (1 + 5 / 30), 6);
    expect(sum.heaviest).toEqual({ weightKg: 90, reps: 3 });
    expect(sum.bestVolumeKg).toBe(680);
    expect(sum.points.map((p) => p.pr)).toEqual([true, true, true]);
    expect(sum.prCount).toBe(3);
  });
  it('has no delta with a single point and nothing with no sessions', () => {
    expect(summarizeExercise(sessions.slice(0, 1)).deltaE1rm).toBeNull();
    const empty = summarizeExercise([]);
    expect(empty.latestE1rm).toBeNull();
    expect(empty.heaviest).toBeNull();
    expect(empty.bestVolumeKg).toBeNull();
  });
});

describe('monthLabels', () => {
  it('labels the first point of each month and thins crowded labels', () => {
    const d = (m: number, day: number) => new Date(2026, m, day, 12).toISOString();
    expect(monthLabels([d(4, 1), d(4, 20), d(6, 2), d(8, 1), d(9, 3)])).toEqual(['mei', '', 'jul', 'sep', 'okt']);
    const many = Array.from({ length: 20 }, (_, i) => d(Math.floor(i / 2), 1 + (i % 2) * 10));
    expect(monthLabels(many).filter(Boolean).length).toBeLessThanOrEqual(5);
    expect(monthLabels([])).toEqual([]);
  });
});

describe('trendSentence', () => {
  const base = { heaviest: null, bestVolumeKg: null, latestE1rm: null, deltaE1rm: null };
  it('describes a rising trend in words with PRs', () => {
    const s = trendSentence(
      'Bench press',
      { ...base, prCount: 2, points: [{ value: 94, pr: false, startedAt: '' }, { value: 108, pr: true, startedAt: '' }] },
      '6m',
    );
    expect(s).toBe('Geschat 1RM Bench press stijgt van 94 naar 108 kilo in zes maanden, met 2 persoonlijke records.');
  });
  it('handles falling, flat, single and empty series', () => {
    const pts = (a: number, b: number) => [{ value: a, pr: false, startedAt: '' }, { value: b, pr: false, startedAt: '' }];
    expect(trendSentence('Squat', { ...base, prCount: 0, points: pts(100, 95) }, '3m')).toBe('Geschat 1RM Squat daalt van 100 naar 95 kilo in drie maanden.');
    expect(trendSentence('Squat', { ...base, prCount: 0, points: pts(100, 100) }, '1y')).toBe('Geschat 1RM Squat blijft 100 kilo in een jaar.');
    expect(trendSentence('Squat', { ...base, prCount: 0, points: [{ value: 102.5, pr: false, startedAt: '' }] }, 'all')).toBe(
      'Geschat 1RM Squat: 102,5 kilo, één training sinds je eerste training.',
    );
    expect(trendSentence('Squat', { ...base, prCount: 0, points: [] }, '3m')).toBe('Nog geen geschat 1RM voor Squat in drie maanden.');
  });
});
