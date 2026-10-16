import { isoWeekRange, MAX_WORKOUT_MINUTES, setsPerMuscle, startOfIsoWeek, summarizeWeeks, weekStats, type WeekSetRow, type WeekWorkoutRow } from '../week';

const at = (y: number, m: number, d: number, h = 18, min = 0) => new Date(y, m, d, h, min).toISOString();

const set = (workout_id: string, over: Partial<WeekSetRow> = {}): WeekSetRow => ({
  workout_id,
  set_type: 'normal',
  weight_kg: 100,
  reps: 5,
  primary_muscle: 'borst',
  secondary_muscles: '["triceps","schouders"]',
  ...over,
});

describe('ISO week', () => {
  it('starts on Monday 00:00 local time', () => {
    const fri = new Date(2026, 9, 16, 15); // Friday 16 Oct 2026
    const mon = startOfIsoWeek(fri);
    expect([mon.getFullYear(), mon.getMonth(), mon.getDate(), mon.getHours()]).toEqual([2026, 9, 12, 0]);
    const sun = startOfIsoWeek(new Date(2026, 9, 18, 23));
    expect(sun.getDate()).toBe(12);
    expect(startOfIsoWeek(new Date(2026, 9, 12, 0, 0)).getDate()).toBe(12);
  });
  it('gives [start, end) ranges with offsets', () => {
    const now = new Date(2026, 9, 16);
    const prev = isoWeekRange(now, -1);
    expect(prev.start.getDate()).toBe(5);
    expect(prev.end.getDate()).toBe(12);
    expect(isoWeekRange(now, 0).end.getDate()).toBe(19);
  });
});

describe('weekStats', () => {
  it('counts workouts, working sets, duration (capped) and volume', () => {
    const workouts: WeekWorkoutRow[] = [
      { id: 'a', started_at: at(2026, 9, 12, 18), ended_at: at(2026, 9, 12, 19) },
      { id: 'b', started_at: at(2026, 9, 14, 8), ended_at: at(2026, 9, 15, 8) }, // forgot to finish
    ];
    const sets = [set('a'), set('a', { set_type: 'warmup', weight_kg: 40 }), set('b', { weight_kg: null, reps: 12 }), set('zzz')];
    expect(weekStats(workouts, sets)).toEqual({ workouts: 2, sets: 2, durationMin: 60 + MAX_WORKOUT_MINUTES, volumeKg: 500 });
  });
});

describe('setsPerMuscle', () => {
  it('counts primary 1 and secondary 0,5 per working set', () => {
    const res = setsPerMuscle([
      set('a'),
      set('a'),
      set('a', { set_type: 'warmup' }),
      set('a', { primary_muscle: 'rug', secondary_muscles: '["biceps"]' }),
      set('a', { primary_muscle: 'quadriceps', secondary_muscles: 'not json' }),
      set('a', { primary_muscle: null }),
    ]);
    expect(res).toEqual([
      { muscle: 'borst', sets: 2 },
      { muscle: 'quadriceps', sets: 1 },
      { muscle: 'rug', sets: 1 },
      { muscle: 'schouders', sets: 1 },
      { muscle: 'triceps', sets: 1 },
      { muscle: 'biceps', sets: 0.5 },
    ]);
  });
  it('ignores a secondary muscle equal to the primary', () => {
    expect(setsPerMuscle([set('a', { secondary_muscles: '["borst"]' })])).toEqual([{ muscle: 'borst', sets: 1 }]);
  });
});

describe('summarizeWeeks', () => {
  const now = new Date(2026, 9, 16, 12);
  const workouts: WeekWorkoutRow[] = [
    { id: 'p1', started_at: at(2026, 9, 6), ended_at: at(2026, 9, 6, 19) },
    { id: 'c1', started_at: at(2026, 9, 13), ended_at: at(2026, 9, 13, 19, 30) },
    { id: 'c2', started_at: at(2026, 9, 15), ended_at: at(2026, 9, 15, 19) },
  ];
  const sets = [set('p1'), set('p1'), set('c1'), set('c2'), set('c2'), set('c2', { primary_muscle: 'rug', secondary_muscles: '[]' })];

  it('splits both weeks and compares them', () => {
    const s = summarizeWeeks(workouts, sets, now);
    expect(s.current).toEqual({ workouts: 2, sets: 4, durationMin: 150, volumeKg: 2000 });
    expect(s.previous).toEqual({ workouts: 1, sets: 2, durationMin: 60, volumeKg: 1000 });
    expect(s.delta).toEqual({ workouts: 1, sets: 2, durationMin: 90, volumeKg: 1000 });
    expect(s.volumeChangePct).toBe(100);
    expect(s.muscles[0]).toEqual({ muscle: 'borst', sets: 3 });
    expect(new Date(s.weekStart).getDate()).toBe(12);
  });
  it('has no volume % without volume last week', () => {
    expect(summarizeWeeks(workouts.slice(1), sets, now).volumeChangePct).toBeNull();
  });
});
