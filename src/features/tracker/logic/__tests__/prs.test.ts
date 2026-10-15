import { computeBests, detectPrs, type PrSetInput } from '../prs';

const s = (
  workoutId: string,
  weightKg: number,
  reps: number,
  extra: Partial<PrSetInput> = {},
): PrSetInput => ({ workoutId, exerciseId: 'bench', setType: 'normal', weightKg, reps, completed: true, ...extra });

const history = [s('w1', 80, 5), s('w1', 80, 5), s('w1', 80, 4)]; // volume 1120, e1rm 93.3

describe('detectPrs', () => {
  it('does not celebrate a first-ever session', () => {
    expect(detectPrs([], [s('w2', 100, 5)])).toEqual([]);
  });

  it('detects heaviest weight, e1RM and volume', () => {
    const prs = detectPrs(history, [s('w2', 85, 5), s('w2', 85, 5), s('w2', 85, 5)]);
    const kinds = prs.map((p) => p.kind).sort();
    expect(kinds).toEqual(['best_e1rm', 'best_volume', 'heaviest_weight']);
    const heavy = prs.find((p) => p.kind === 'heaviest_weight');
    expect(heavy?.value).toBe(85);
    expect(heavy?.previous).toBe(80);
    expect(prs.find((p) => p.kind === 'best_volume')?.value).toBe(1275);
  });

  it('detects most reps at a weight', () => {
    const prs = detectPrs(history, [s('w2', 80, 7)]);
    const reps = prs.find((p) => p.kind === 'most_reps_at_weight');
    expect(reps).toMatchObject({ value: 7, previous: 5, weightKg: 80 });
  });

  it('counts heavier history when comparing reps at a lighter weight', () => {
    // 6 reps at 75 is not a PR when 80 × 5 exists? It is: never did 6+ at ≥75.
    expect(detectPrs(history, [s('w2', 75, 6)]).some((p) => p.kind === 'most_reps_at_weight')).toBe(true);
    // 5 reps at 75 is not: already did 5 reps at 80.
    expect(detectPrs(history, [s('w2', 75, 5)]).some((p) => p.kind === 'most_reps_at_weight')).toBe(false);
  });

  it('ignores warmups and unfinished sets', () => {
    expect(detectPrs(history, [s('w2', 120, 5, { setType: 'warmup' }), s('w2', 120, 5, { completed: false })])).toEqual(
      [],
    );
  });

  it('reports at most one PR per kind per exercise', () => {
    const prs = detectPrs(history, [s('w2', 82.5, 5), s('w2', 85, 3), s('w2', 90, 1)]);
    expect(prs.filter((p) => p.kind === 'heaviest_weight')).toHaveLength(1);
    expect(prs.find((p) => p.kind === 'heaviest_weight')?.value).toBe(90);
  });

  it('keeps exercises separate', () => {
    const other = s('w2', 200, 5, { exerciseId: 'squat' });
    expect(detectPrs(history, [other])).toEqual([]);
  });
});

describe('computeBests', () => {
  it('tracks the best session volume', () => {
    const b = computeBests([...history, s('w0', 60, 10)]).get('bench');
    expect(b?.bestSessionVolume).toBe(1120);
    expect(b?.heaviestWeight).toBe(80);
  });
});
