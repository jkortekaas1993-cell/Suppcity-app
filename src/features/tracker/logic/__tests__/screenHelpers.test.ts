import { formatClockNl, formatLongDateNl, formatSignedPct, formatTonnes } from '../format';
import { estimateRoutineMinutes } from '../routines';
import { pickHeadlinePr, workoutVolumeKg } from '../summaryView';

describe('release 2a screen helpers', () => {
  it('formats the Vandaag date and tonnes', () => {
    expect(formatLongDateNl(new Date(2026, 9, 16, 9))).toBe('Vrijdag 16 oktober');
    expect(formatLongDateNl('nope')).toBe('–');
    expect(formatTonnes(18_420)).toBe('18,4');
    expect(formatTonnes(0)).toBe('0');
    expect(formatSignedPct(8)).toBe('+8%');
    expect(formatSignedPct(-3)).toBe('-3%');
    expect(formatSignedPct(0)).toBe('0%');
    expect(formatClockNl(new Date(2026, 9, 16, 7, 5))).toBe('7:05');
  });

  it('estimates routine minutes rounded to 5', () => {
    expect(estimateRoutineMinutes([])).toBe(0);
    // 6 exercises × 3 sets × (45 + 120) s = 2970 s ≈ 49.5 min -> 50
    expect(estimateRoutineMinutes(Array.from({ length: 6 }, () => ({ target_sets: 3, rest_seconds: 120 })))).toBe(50);
    expect(estimateRoutineMinutes([{ target_sets: 1, rest_seconds: 0 }])).toBe(5);
  });

  it('picks the most celebratory PR for the summary card', () => {
    const base = { exerciseId: 'b', exerciseName: 'Bench press', weightKg: 100, reps: 3 };
    const volume = { ...base, kind: 'best_volume' as const, value: 3000, previous: 2800 };
    const reps = { ...base, kind: 'most_reps_at_weight' as const, value: 6, previous: 5 };
    const e1rm = { ...base, kind: 'best_e1rm' as const, value: 110, previous: 105 };
    const heavy = { ...base, kind: 'heaviest_weight' as const, value: 100, previous: 92.5 };
    expect(pickHeadlinePr([])).toBeNull();
    expect(pickHeadlinePr([volume, reps])?.kind).toBe('most_reps_at_weight');
    expect(pickHeadlinePr([volume, e1rm, reps])?.kind).toBe('best_e1rm');
    expect(pickHeadlinePr([volume, e1rm, heavy])?.kind).toBe('heaviest_weight');
    // Between two heaviest-weight PRs, the heavier lift wins.
    expect(pickHeadlinePr([heavy, { ...heavy, exerciseId: 's', value: 140, weightKg: 140 }])?.exerciseId).toBe('s');
  });

  it('sums live workout volume over ticked working sets', () => {
    expect(
      workoutVolumeKg([
        { sets: [{ setType: 'normal', weightKg: 100, reps: 5, completedAt: 1 }, { setType: 'warmup', weightKg: 60, reps: 10, completedAt: 1 }] },
        { sets: [{ setType: 'normal', weightKg: 50, reps: 10, completedAt: null }, { setType: 'dropset', weightKg: 40, reps: 8, completedAt: 2 }] },
      ]),
    ).toBe(820);
  });
});
