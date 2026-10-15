import type {
  Exercise,
  IsoDateTime,
  MuscleGroup,
  NewRow,
  Routine,
  RoutineExercise,
  SetType,
  Uuid,
  Workout,
  WorkoutSet,
  WorkoutSource,
} from './types';

/**
 * Repository contracts. UI and features talk to these interfaces only, never to
 * SQL directly. The Tracker builder implements them on expo-sqlite
 * (sqliteRepositories.ts); the Backend&Sync builder uses `changesSince` /
 * `applyRemote` for sync.
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
  /** Highest position in use, or -1 when there are no routines. */
  maxPosition(): Promise<number>;
}

export interface PreviousSetSummary {
  workout_id: Uuid;
  started_at: IsoDateTime;
  sets: Pick<WorkoutSet, 'position' | 'set_type' | 'weight_kg' | 'reps'>[];
}

export interface WorkoutListItem extends Workout {
  set_count: number;
  /** kg × reps over completed non-warmup sets. */
  volume_kg: number;
  exercise_count: number;
}

export interface WorkoutRepository {
  start(input: NewRow<Workout>): Promise<Workout>;
  finish(id: Uuid, endedAt: IsoDateTime): Promise<void>;
  update(id: Uuid, patch: Partial<Pick<Workout, 'title' | 'notes'>>): Promise<void>;
  get(id: Uuid): Promise<{ workout: Workout; sets: WorkoutSet[] } | null>;
  /** Finished workouts, newest first. */
  history(opts: { limit: number; before?: IsoDateTime }): Promise<Workout[]>;
  /** Finished workouts with totals, newest first. */
  historyWithStats(opts: { limit: number; before?: IsoDateTime }): Promise<WorkoutListItem[]>;
  lastFinished(): Promise<Workout | null>;
  /** Soft-deletes the workout and its sets. */
  softDelete(id: Uuid): Promise<void>;
}

/** A completed set joined with its workout start, for progress and PRs. */
export interface ExerciseSetHistoryRow {
  id: Uuid;
  workout_id: Uuid;
  exercise_id: Uuid;
  started_at: IsoDateTime;
  set_type: SetType;
  weight_kg: number | null;
  reps: number | null;
}

export interface SetRepository {
  add(input: NewRow<WorkoutSet>): Promise<WorkoutSet>;
  update(id: Uuid, patch: Partial<NewRow<WorkoutSet>>): Promise<void>;
  /** Insert or replace by id (restores a soft-deleted row). Used by the live workout. */
  upsertMany(rows: (NewRow<WorkoutSet> & { id: Uuid })[]): Promise<void>;
  softDelete(id: Uuid): Promise<void>;
  softDeleteMany(ids: Uuid[]): Promise<void>;
  /** "Vorige keer": sets from the most recent finished workout containing this exercise. */
  previousFor(exerciseId: Uuid, beforeWorkoutId?: Uuid): Promise<PreviousSetSummary | null>;
  /** Best estimated 1RM / heaviest set per exercise, for PR detection. */
  personalRecords(exerciseId: Uuid): Promise<{ heaviest: WorkoutSet | null; bestE1rm: number | null }>;
  /** Completed sets of finished workouts for these exercises, oldest first. */
  completedHistory(exerciseIds: Uuid[], opts?: { excludeWorkoutId?: Uuid }): Promise<ExerciseSetHistoryRow[]>;
  /** Exercise ids that have at least one completed set in a finished workout. */
  exercisesWithHistory(): Promise<{ exercise_id: Uuid; last_started_at: IsoDateTime; workouts: number }[]>;
}

/** Flat export row (hard rule 9). */
export interface ExportJoinRow {
  workout_id: Uuid;
  title: string;
  started_at: IsoDateTime;
  ended_at: IsoDateTime | null;
  notes: string | null;
  source: WorkoutSource;
  exercise_id: Uuid;
  exercise_name: string;
  position: number;
  set_type: SetType;
  weight_kg: number | null;
  reps: number | null;
  rpe: number | null;
  completed_at: IsoDateTime | null;
}

export interface ImportWorkoutInput {
  workout: NewRow<Workout>;
  sets: Omit<NewRow<WorkoutSet>, 'workout_id'>[];
}

export interface DataPortRepository {
  /** All own, non-deleted, finished workouts with completed sets, oldest first. */
  exportRows(): Promise<ExportJoinRow[]>;
  /**
   * Inserts imported workouts and creates the given custom exercises, in one
   * transaction. Skips a workout when one with the same source + started_at exists.
   */
  importWorkouts(input: {
    newExercises: NewRow<Exercise>[];
    workouts: ImportWorkoutInput[];
  }): Promise<{ imported: number; skipped: number }>;
}

/** Local-only key/value store (active workout snapshot, preferences). Never synced. */
export interface AppStateRepository {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
}

/**
 * Sync seam for Backend&Sync (custom sync now, PowerSync later). Includes soft-deleted
 * rows. Structurally satisfies `LocalSyncStore` in src/lib/db/sync/types.ts.
 */
export interface SyncSource {
  /** Only rows of `userId` or without owner (user_id IS NULL): never another account's rows. */
  changesSince(table: string, updatedAfter: IsoDateTime | null, userId: Uuid): Promise<Record<string, unknown>[]>;
  /** Rows by id (incl. soft-deleted), same shape as `changesSince`; missing ids are omitted. */
  getByIds(table: string, ids: string[]): Promise<Record<string, unknown>[]>;
  /** Writes already-merged rows verbatim: keeps their updated_at, no LWW check, no bump. */
  applyRemote(table: string, rows: Record<string, unknown>[]): Promise<void>;
  /** Attach anonymous local rows to the logged-in user after first login. */
  claimAnonymousRows(userId: Uuid): Promise<void>;
}

export interface Repositories {
  exercises: ExerciseRepository;
  routines: RoutineRepository;
  workouts: WorkoutRepository;
  sets: SetRepository;
  dataPort: DataPortRepository;
  appState: AppStateRepository;
  sync: SyncSource;
  /** Inserts/updates the built-in exercise library (idempotent). */
  seedLibrary(): Promise<void>;
  /**
   * Hard rule 3: after the account is deleted, removes ALL local tracker data and
   * local app state (incl. sync cursors and the active-workout snapshot), then
   * re-seeds the built-in library so the app keeps working signed-out.
   */
  wipeLocalData(): Promise<void>;
}
