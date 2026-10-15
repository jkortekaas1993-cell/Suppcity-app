import { EXERCISES_NL } from '@/content/exercises.nl';
import type { Repositories } from '@/lib/db/repositories';
import type { Exercise, NewRow } from '@/lib/db/types';

import { workoutsToCsv } from '../logic/csvExport';
import {
  buildAliasIndex,
  mapExerciseNames,
  normalizeExerciseName,
  parseWorkoutCsv,
  type CsvFormat,
} from '../logic/csvImport';

/**
 * CSV import (Hevy/Strong) and export (all own data, hard rule 9).
 * Glue between the pure parsers and the repository layer.
 */
export interface ImportSummary {
  format: CsvFormat;
  imported: number;
  skipped: number;
  createdExercises: string[];
  warnings: string[];
}

export async function importWorkoutCsv(
  repos: Repositories,
  text: string,
  newId: () => string,
): Promise<ImportSummary> {
  const parsed = parseWorkoutCsv(text);

  // Library aliases first, then existing (custom) exercises by Dutch name.
  const existing = await repos.exercises.list();
  const index = buildAliasIndex([
    ...EXERCISES_NL.map((e) => ({ id: e.slug, name: e.name_nl, aliases: e.aliases_en })),
    ...existing.map((e) => ({ id: e.id, name: e.name_nl })),
  ]);
  const names = parsed.workouts.flatMap((w) => w.sets.map((s) => s.exerciseName));
  const mapping = mapExerciseNames(names, index);

  // Unknown exercises become custom exercises (category unknown until the user edits it).
  const newExercises: NewRow<Exercise>[] = mapping.unknown.map((name) => ({
    id: newId(),
    slug: null,
    name_nl: name,
    primary_muscle: 'full_body',
    secondary_muscles: [],
    equipment: 'other',
    is_custom: true,
  }));
  const createdByName = new Map(newExercises.map((e) => [normalizeExerciseName(e.name_nl), e.id ?? '']));
  const resolve = (name: string): string | undefined =>
    mapping.matched.get(name) ?? createdByName.get(normalizeExerciseName(name));

  const workouts = parsed.workouts.map((w) => ({
    workout: {
      id: newId(),
      routine_id: null,
      title: w.title,
      started_at: w.startedAt,
      ended_at: w.endedAt,
      notes: w.notes,
      source: w.source,
    },
    sets: w.sets.flatMap((s) => {
      const exerciseId = resolve(s.exerciseName);
      if (!exerciseId) return [];
      return [
        {
          id: newId(),
          exercise_id: exerciseId,
          position: s.position,
          set_type: s.setType,
          weight_kg: s.weightKg,
          reps: s.reps,
          rpe: s.rpe,
          completed_at: w.endedAt ?? w.startedAt,
        },
      ];
    }),
  }));

  const result = await repos.dataPort.importWorkouts({ newExercises, workouts });
  return {
    format: parsed.format,
    imported: result.imported,
    skipped: result.skipped,
    createdExercises: mapping.unknown,
    warnings: parsed.warnings,
  };
}

export async function exportAllCsv(repos: Repositories): Promise<{ csv: string; rows: number }> {
  const rows = await repos.dataPort.exportRows();
  const indexByWorkout = new Map<string, number>();
  const csv = workoutsToCsv(
    rows.map((r) => {
      const key = `${r.workout_id}|${r.exercise_id}`;
      const setIndex = indexByWorkout.get(key) ?? 0;
      indexByWorkout.set(key, setIndex + 1);
      return {
        workoutId: r.workout_id,
        title: r.title,
        startedAt: r.started_at,
        endedAt: r.ended_at,
        notes: r.notes,
        source: r.source,
        exerciseId: r.exercise_id,
        exerciseName: r.exercise_name,
        setIndex,
        setType: r.set_type,
        weightKg: r.weight_kg,
        reps: r.reps,
        rpe: r.rpe,
        completedAt: r.completed_at,
      };
    }),
  );
  return { csv, rows: rows.length };
}
