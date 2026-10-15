import type {
  Exercise,
  IsoDateTime,
  MuscleGroup,
  NewRow,
  Routine,
  RoutineExercise,
  Uuid,
  Workout,
  WorkoutSet,
} from './types';

/**
 * Repository contracts. UI and features talk to these interfaces only, never to
 * SQL directly. The Tracker builder implements them on expo-sqlite; the
 * Backend&Sync builder uses `changesSince` / `applyRemote` for sync.
 *
 * All reads exclude soft-deleted rows unless stated otherwise.
 */

export interface ExerciseRepository {
  list(filter?: { muscle?: MuscleGroup; search?: string }): Promise<Exercise[]>;
  get(id: Uuid): Promise<Exercise | null>;
  createCustom(input: NewRow<Exercise>): Promise<Exercise>;
  softDelete(id: Uuid): Promise<void>;
}

export interface RoutineRepository {
  list(): Promise<Routine[]>;
  get(id: Uuid): Promise<{ routine: Routine; exercises: RoutineExercise[] } | null>;
  create(input: NewRow<Routine>, exercises: NewRow<RoutineExercise>[]): Promise<Routine>;
  update(id: Uuid, patch: Partial<NewRow<Routine>>): Promise<void>;
  replaceExercises(routineId: Uuid, exercises: NewRow<RoutineExercise>[]): Promise<void>;
  softDelete(id: Uuid): Promise<void>;
}

export interface PreviousSetSummary {
  workout_id: Uuid;
  started_at: IsoDateTime;
  sets: Pick<WorkoutSet, 'position' | 'set_type' | 'weight_kg' | 'reps'>[];
}

export interface WorkoutRepository {
  start(input: NewRow<Workout>): Promise<Workout>;
  finish(id: Uuid, endedAt: IsoDateTime): Promise<void>;
  get(id: Uuid): Promise<{ workout: Workout; sets: WorkoutSet[] } | null>;
  history(opts: { limit: number; before?: IsoDateTime }): Promise<Workout[]>;
  softDelete(id: Uuid): Promise<void>;
}

export interface SetRepository {
  add(input: NewRow<WorkoutSet>): Promise<WorkoutSet>;
  update(id: Uuid, patch: Partial<NewRow<WorkoutSet>>): Promise<void>;
  softDelete(id: Uuid): Promise<void>;
  /** "Vorige keer": sets from the most recent finished workout containing this exercise. */
  previousFor(exerciseId: Uuid, beforeWorkoutId?: Uuid): Promise<PreviousSetSummary | null>;
  /** Best estimated 1RM / heaviest set per exercise, for PR detection. */
  personalRecords(exerciseId: Uuid): Promise<{ heaviest: WorkoutSet | null; bestE1rm: number | null }>;
}

/** Sync seam for Backend&Sync (custom sync now, PowerSync later). Includes soft-deleted rows. */
export interface SyncSource {
  changesSince(table: string, updatedAfter: IsoDateTime | null): Promise<Record<string, unknown>[]>;
  applyRemote(table: string, rows: Record<string, unknown>[]): Promise<void>;
  /** Attach anonymous local rows to the logged-in user after first login. */
  claimAnonymousRows(userId: Uuid): Promise<void>;
}

export interface Repositories {
  exercises: ExerciseRepository;
  routines: RoutineRepository;
  workouts: WorkoutRepository;
  sets: SetRepository;
  sync: SyncSource;
}
