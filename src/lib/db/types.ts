/** Row types for local tables. Keep in sync with schema.ts and supabase/migrations. */

export type Uuid = string;
export type IsoDateTime = string;

export interface SyncFields {
  id: Uuid;
  user_id: Uuid | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
  deleted_at: IsoDateTime | null;
}

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'cable'
  | 'bodyweight'
  | 'kettlebell'
  | 'band'
  | 'other';

export type MuscleGroup =
  | 'borst'
  | 'rug'
  | 'schouders'
  | 'biceps'
  | 'triceps'
  | 'onderarmen'
  | 'quadriceps'
  | 'hamstrings'
  | 'billen'
  | 'kuiten'
  | 'buik'
  | 'onderrug'
  | 'full_body';

export interface Exercise extends SyncFields {
  slug: string | null;
  name_nl: string;
  primary_muscle: MuscleGroup;
  /** JSON array of MuscleGroup in SQLite; parsed by the repository. */
  secondary_muscles: MuscleGroup[];
  equipment: Equipment;
  is_custom: boolean;
}

export interface Routine extends SyncFields {
  name: string;
  notes: string | null;
  program_slug: string | null;
  position: number;
}

export interface RoutineExercise extends SyncFields {
  routine_id: Uuid;
  exercise_id: Uuid;
  position: number;
  target_sets: number;
  target_reps_min: number | null;
  target_reps_max: number | null;
  rest_seconds: number;
}

export type WorkoutSource = 'app' | 'import_hevy' | 'import_strong';

export interface Workout extends SyncFields {
  routine_id: Uuid | null;
  title: string;
  started_at: IsoDateTime;
  ended_at: IsoDateTime | null;
  notes: string | null;
  source: WorkoutSource;
}

export type SetType = 'warmup' | 'normal' | 'dropset' | 'failure';

export interface WorkoutSet extends SyncFields {
  workout_id: Uuid;
  exercise_id: Uuid;
  position: number;
  set_type: SetType;
  weight_kg: number | null;
  reps: number | null;
  rpe: number | null;
  completed_at: IsoDateTime | null;
}

/** An earned milestone (local only; see schema migration 3). */
export interface UserBadge extends SyncFields {
  /** Catalogue id, e.g. "bench_100" (src/features/tracker/logic/badges.ts). */
  badge_id: string;
  earned_at: IsoDateTime;
  /** The workout that earned it. */
  source_ref: Uuid | null;
}

/** Input type for inserts: sync fields are filled in by the repository. */
export type NewRow<T extends SyncFields> = Omit<T, keyof SyncFields> & Partial<Pick<T, 'id' | 'user_id'>>;
