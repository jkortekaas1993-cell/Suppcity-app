import type { ProgramSeed } from '@/content/programs';

/** Pure helpers for routines and programs. */

export interface RoutineDraft {
  name: string;
  programSlug: string;
  position: number;
  exercises: {
    exerciseId: string;
    position: number;
    targetSets: number;
    targetRepsMin: number;
    targetRepsMax: number;
    restSeconds: number;
  }[];
}

/** One routine per program day, positioned after `startPosition`. */
export function routinesFromProgram(program: ProgramSeed, startPosition = 0): RoutineDraft[] {
  return program.days.map((day, i) => ({
    name: `${program.name}: ${day.name}`,
    programSlug: program.slug,
    position: startPosition + i,
    exercises: day.exercises.map((e, j) => ({
      exerciseId: e.slug,
      position: j,
      targetSets: e.sets,
      targetRepsMin: e.repsMin,
      targetRepsMax: e.repsMax,
      restSeconds: e.restSeconds,
    })),
  }));
}

export interface RoutineRef {
  id: string;
  position: number;
  programSlug: string | null;
}

/**
 * Next planned routine: the one after the routine of the last workout,
 * cycling within the same program when it has one. Without history, the
 * first routine by position.
 */
export function nextRoutine<T extends RoutineRef>(routines: readonly T[], lastRoutineId: string | null): T | null {
  const sorted = [...routines].sort((a, b) => a.position - b.position);
  if (sorted.length === 0) return null;
  const last = lastRoutineId ? sorted.find((r) => r.id === lastRoutineId) : undefined;
  if (!last) return sorted[0] ?? null;
  const cycle = last.programSlug ? sorted.filter((r) => r.programSlug === last.programSlug) : sorted;
  const idx = cycle.findIndex((r) => r.id === last.id);
  return cycle[(idx + 1) % cycle.length] ?? sorted[0] ?? null;
}

export function formatRepRange(min: number | null, max: number | null): string {
  if (min == null && max == null) return '';
  if (min == null || max == null || min === max) return `${min ?? max}`;
  return `${min}–${max}`;
}
