import { PROGRAMS } from '@/content/programs';
import type { Repositories } from '@/lib/db/repositories';
import type { Routine } from '@/lib/db/types';

import { routinesFromProgram } from '../logic/routines';

/** Adds all days of a ready-made program as routines, after existing ones. */
export async function addProgramAsRoutines(repos: Repositories, programSlug: string): Promise<Routine[]> {
  const program = PROGRAMS.find((p) => p.slug === programSlug);
  if (!program) throw new Error(`Unknown program: ${programSlug}`);
  const start = (await repos.routines.maxPosition()) + 1;
  const created: Routine[] = [];
  for (const draft of routinesFromProgram(program, start)) {
    created.push(
      await repos.routines.create(
        { name: draft.name, notes: null, program_slug: draft.programSlug, position: draft.position },
        draft.exercises.map((e) => ({
          routine_id: '', // filled in by the repository
          exercise_id: e.exerciseId,
          position: e.position,
          target_sets: e.targetSets,
          target_reps_min: e.targetRepsMin,
          target_reps_max: e.targetRepsMax,
          rest_seconds: e.restSeconds,
        })),
      ),
    );
  }
  return created;
}
