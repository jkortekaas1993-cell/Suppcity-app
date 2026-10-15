import type { Repositories } from '@/lib/db/repositories';

import { detectPrs, type PersonalRecord, type PrSetInput } from '../logic/prs';
import { summarizeWorkout, type WorkoutSummary } from '../logic/summary';

/** Summary of a finished workout including PRs against earlier history. */
export interface WorkoutReport {
  summary: WorkoutSummary;
  prs: (PersonalRecord & { exerciseName: string })[];
}

export async function buildWorkoutReport(repos: Repositories, workoutId: string): Promise<WorkoutReport | null> {
  const found = await repos.workouts.get(workoutId);
  if (!found) return null;
  const { workout, sets } = found;

  const current: PrSetInput[] = sets.map((s) => ({
    workoutId,
    exerciseId: s.exercise_id,
    setType: s.set_type,
    weightKg: s.weight_kg,
    reps: s.reps,
    completed: s.completed_at !== null,
  }));
  const exerciseIds = [...new Set(sets.map((s) => s.exercise_id))];
  // Only workouts that started before this one count as history.
  const history = (await repos.sets.completedHistory(exerciseIds, { excludeWorkoutId: workoutId }))
    .filter((h) => h.started_at < workout.started_at)
    .map<PrSetInput>((h) => ({
      workoutId: h.workout_id,
      exerciseId: h.exercise_id,
      setType: h.set_type,
      weightKg: h.weight_kg,
      reps: h.reps,
      completed: true,
    }));

  const prs = detectPrs(history, current);
  const names = new Map<string, string>();
  for (const id of exerciseIds) names.set(id, (await repos.exercises.get(id))?.name_nl ?? 'Oefening');

  return {
    summary: summarizeWorkout(
      workout.started_at,
      workout.ended_at,
      sets.map((s) => ({
        exerciseId: s.exercise_id,
        setType: s.set_type,
        weightKg: s.weight_kg,
        reps: s.reps,
        completed: s.completed_at !== null,
      })),
    ),
    prs: prs.map((p) => ({ ...p, exerciseName: names.get(p.exerciseId) ?? 'Oefening' })),
  };
}
