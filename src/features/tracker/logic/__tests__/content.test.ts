import { EXERCISES_NL } from '@/content/exercises.nl';
import { PROGRAMS } from '@/content/programs';

describe('exercise library', () => {
  it('has at least 60 exercises with unique slugs and descriptions', () => {
    expect(EXERCISES_NL.length).toBeGreaterThanOrEqual(60);
    expect(new Set(EXERCISES_NL.map((e) => e.slug)).size).toBe(EXERCISES_NL.length);
    for (const e of EXERCISES_NL) {
      expect(e.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(e.aliases_en.length).toBeGreaterThan(0);
      expect(e.description_nl.length).toBeGreaterThan(20);
    }
  });
  it('covers every main muscle area and equipment type', () => {
    const muscles = new Set(EXERCISES_NL.map((e) => e.primary_muscle));
    for (const m of ['borst', 'rug', 'quadriceps', 'hamstrings', 'schouders', 'biceps', 'triceps', 'buik'] as const) {
      expect(muscles.has(m)).toBe(true);
    }
    const eq = new Set(EXERCISES_NL.map((e) => e.equipment));
    for (const x of ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'] as const) expect(eq.has(x)).toBe(true);
  });
});

describe('programs', () => {
  it('ships the three MVP programs referencing known slugs', () => {
    expect(PROGRAMS.map((p) => p.slug)).toEqual(['full-body-3x', 'push-pull-legs', 'upper-lower']);
    const slugs = new Set(EXERCISES_NL.map((e) => e.slug));
    for (const p of PROGRAMS)
      for (const d of p.days)
        for (const e of d.exercises) {
          expect(slugs.has(e.slug)).toBe(true);
          expect(e.repsMin).toBeLessThanOrEqual(e.repsMax);
        }
  });
});
