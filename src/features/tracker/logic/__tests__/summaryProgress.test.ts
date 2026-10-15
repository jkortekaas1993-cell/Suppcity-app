import { PROGRAMS } from '@/content/programs';

import { exerciseProgress, normalizeSeries } from '../progress';
import { formatRepRange, nextRoutine, routinesFromProgram } from '../routines';
import { bestSet, summarizeWorkout } from '../summary';

describe('summarizeWorkout', () => {
  it('sums duration, volume and sets (warmups excluded from volume)', () => {
    const sum = summarizeWorkout('2026-10-15T10:00:00.000Z', '2026-10-15T11:05:00.000Z', [
      { exerciseId: 'a', setType: 'warmup', weightKg: 40, reps: 10, completed: true },
      { exerciseId: 'a', setType: 'normal', weightKg: 80, reps: 5, completed: true },
      { exerciseId: 'b', setType: 'normal', weightKg: 50, reps: 10, completed: true },
      { exerciseId: 'b', setType: 'normal', weightKg: 50, reps: 10, completed: false },
    ]);
    expect(sum).toEqual({ durationMs: 65 * 60_000, volumeKg: 900, completedSets: 3, totalReps: 15, exerciseCount: 2 });
  });
  it('picks the best set by e1RM', () => {
    expect(bestSet([{ weightKg: 100, reps: 1 }, { weightKg: 90, reps: 5 }, { weightKg: null, reps: 3 }])).toEqual({
      weightKg: 90,
      reps: 5,
    });
    expect(bestSet([])).toBeNull();
  });
});

describe('exerciseProgress', () => {
  it('groups by workout, sorted by date', () => {
    const pts = exerciseProgress([
      { workoutId: 'w2', startedAt: '2026-02-01T00:00:00Z', setType: 'normal', weightKg: 100, reps: 3 },
      { workoutId: 'w1', startedAt: '2026-01-01T00:00:00Z', setType: 'normal', weightKg: 90, reps: 5 },
      { workoutId: 'w1', startedAt: '2026-01-01T00:00:00Z', setType: 'warmup', weightKg: 200, reps: 5 },
    ]);
    expect(pts.map((p) => p.workoutId)).toEqual(['w1', 'w2']);
    expect(pts[0]?.e1rm).toBeCloseTo(105, 5);
    expect(pts[0]?.volumeKg).toBe(450);
  });
  it('normalizes a series for bars', () => {
    expect(normalizeSeries([])).toEqual([]);
    expect(normalizeSeries([5, 5])).toEqual([1, 1]);
    const n = normalizeSeries([100, 150, 200]);
    expect(n[0]).toBeCloseTo(0.15, 5);
    expect(n[2]).toBe(1);
  });
});

describe('routines', () => {
  it('creates one routine per program day', () => {
    const ppl = PROGRAMS.find((p) => p.slug === 'push-pull-legs');
    if (!ppl) throw new Error('missing program');
    const drafts = routinesFromProgram(ppl, 5);
    expect(drafts.map((d) => d.position)).toEqual([5, 6, 7]);
    expect(drafts[0]?.name).toBe('Push / Pull / Legs: Push');
    expect(drafts[0]?.exercises[0]).toMatchObject({ exerciseId: 'bench-press-barbell', position: 0 });
  });

  it('cycles to the next routine within a program', () => {
    const rs = [
      { id: 'a', position: 0, programSlug: 'p' },
      { id: 'b', position: 1, programSlug: 'p' },
      { id: 'c', position: 2, programSlug: null },
    ];
    expect(nextRoutine(rs, null)?.id).toBe('a');
    expect(nextRoutine(rs, 'a')?.id).toBe('b');
    expect(nextRoutine(rs, 'b')?.id).toBe('a');
    expect(nextRoutine(rs, 'c')?.id).toBe('a');
    expect(nextRoutine([], 'x')).toBeNull();
  });

  it('formats rep ranges', () => {
    expect(formatRepRange(8, 12)).toBe('8–12');
    expect(formatRepRange(5, 5)).toBe('5');
    expect(formatRepRange(null, null)).toBe('');
  });
});
