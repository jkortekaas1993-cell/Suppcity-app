import type { SetType } from '@/lib/db/types';

/**
 * Pure reducer for the in-progress workout. No ids, clocks or I/O inside:
 * callers pass generated ids and `now` in the action, which keeps this
 * deterministic and testable. Persistence is done by the controller that
 * dispatches these actions (see ../activeWorkoutStore.ts).
 */

export const DEFAULT_REST_SECONDS = 90;

export interface PreviousSetValue {
  weightKg: number | null;
  reps: number | null;
}

export interface ActiveSet {
  id: string;
  /** Workout-wide position; sets of one exercise are ordered by it. */
  position: number;
  setType: SetType;
  weightKg: number | null;
  reps: number | null;
  /** epoch ms when ticked off; null while open. */
  completedAt: number | null;
}

export interface ActiveExercise {
  exerciseId: string;
  name: string;
  restSeconds: number;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  sets: ActiveSet[];
  /** "Vorige keer": sets of the last finished workout with this exercise, by index. */
  previous: PreviousSetValue[];
}

export interface ActiveWorkoutState {
  workoutId: string;
  title: string;
  routineId: string | null;
  startedAt: number; // epoch ms
  /** When a rest timer is running: epoch ms at which it ends. */
  restEndsAt: number | null;
  /** Length of the running rest timer in seconds (for progress display). */
  restDurationSeconds: number | null;
  exercises: ActiveExercise[];
}

export interface NewExerciseInput {
  exerciseId: string;
  name: string;
  restSeconds?: number;
  targetRepsMin?: number | null;
  targetRepsMax?: number | null;
  previous?: PreviousSetValue[];
  /** Ids for the initial sets (one set per id). */
  setIds: string[];
}

export type ActiveWorkoutAction =
  | {
      type: 'start';
      workoutId: string;
      title: string;
      routineId?: string | null;
      startedAt: number;
      exercises?: NewExerciseInput[];
    }
  | { type: 'hydrate'; state: ActiveWorkoutState | null }
  | { type: 'rename'; title: string }
  | { type: 'addExercise'; exercise: NewExerciseInput }
  | { type: 'removeExercise'; exerciseId: string }
  | { type: 'addSet'; exerciseId: string; setId: string }
  | { type: 'removeSet'; setId: string }
  | { type: 'updateSet'; setId: string; patch: Partial<Pick<ActiveSet, 'weightKg' | 'reps' | 'setType'>> }
  | { type: 'toggleSet'; setId: string; now: number }
  | { type: 'setRestSeconds'; exerciseId: string; seconds: number }
  | { type: 'adjustRest'; deltaSeconds: number; now: number }
  | { type: 'skipRest' }
  | { type: 'end' };

function maxPosition(state: ActiveWorkoutState): number {
  let max = -1;
  for (const e of state.exercises) for (const s of e.sets) max = Math.max(max, s.position);
  return max;
}

function buildExercise(input: NewExerciseInput, firstPosition: number): ActiveExercise {
  const previous = input.previous ?? [];
  return {
    exerciseId: input.exerciseId,
    name: input.name,
    restSeconds: input.restSeconds ?? DEFAULT_REST_SECONDS,
    targetRepsMin: input.targetRepsMin ?? null,
    targetRepsMax: input.targetRepsMax ?? null,
    previous,
    sets: input.setIds.map((id, i) => ({
      id,
      position: firstPosition + i,
      setType: 'normal',
      // Prefill with last time's values so a repeat is one tap.
      weightKg: previous[i]?.weightKg ?? null,
      reps: previous[i]?.reps ?? null,
      completedAt: null,
    })),
  };
}

function mapSet(
  state: ActiveWorkoutState,
  setId: string,
  fn: (set: ActiveSet, exercise: ActiveExercise) => ActiveSet,
): ActiveWorkoutState {
  let changed = false;
  const exercises = state.exercises.map((e) => {
    if (!e.sets.some((s) => s.id === setId)) return e;
    changed = true;
    return { ...e, sets: e.sets.map((s) => (s.id === setId ? fn(s, e) : s)) };
  });
  return changed ? { ...state, exercises } : state;
}

export function findSet(
  state: ActiveWorkoutState,
  setId: string,
): { exercise: ActiveExercise; set: ActiveSet; index: number } | null {
  for (const exercise of state.exercises) {
    const index = exercise.sets.findIndex((s) => s.id === setId);
    const set = exercise.sets[index];
    if (set) return { exercise, set, index };
  }
  return null;
}

export function activeWorkoutReducer(
  state: ActiveWorkoutState | null,
  action: ActiveWorkoutAction,
): ActiveWorkoutState | null {
  if (action.type === 'start') {
    let pos = 0;
    const exercises = (action.exercises ?? []).map((input) => {
      const e = buildExercise(input, pos);
      pos += input.setIds.length;
      return e;
    });
    return {
      workoutId: action.workoutId,
      title: action.title,
      routineId: action.routineId ?? null,
      startedAt: action.startedAt,
      restEndsAt: null,
      restDurationSeconds: null,
      exercises,
    };
  }
  if (action.type === 'hydrate') return action.state;
  if (!state) return state;

  switch (action.type) {
    case 'rename':
      return { ...state, title: action.title };

    case 'addExercise': {
      if (state.exercises.some((e) => e.exerciseId === action.exercise.exerciseId)) return state;
      const e = buildExercise(action.exercise, maxPosition(state) + 1);
      return { ...state, exercises: [...state.exercises, e] };
    }

    case 'removeExercise':
      return { ...state, exercises: state.exercises.filter((e) => e.exerciseId !== action.exerciseId) };

    case 'addSet': {
      const position = maxPosition(state) + 1;
      return {
        ...state,
        exercises: state.exercises.map((e) => {
          if (e.exerciseId !== action.exerciseId) return e;
          const index = e.sets.length;
          const last = e.sets[index - 1];
          const prev = e.previous[index];
          return {
            ...e,
            sets: [
              ...e.sets,
              {
                id: action.setId,
                position,
                setType: 'normal',
                // Copy the set above; fall back to last time's values.
                weightKg: last?.weightKg ?? prev?.weightKg ?? null,
                reps: last?.reps ?? prev?.reps ?? null,
                completedAt: null,
              },
            ],
          };
        }),
      };
    }

    case 'removeSet':
      return {
        ...state,
        exercises: state.exercises.map((e) =>
          e.sets.some((s) => s.id === action.setId) ? { ...e, sets: e.sets.filter((s) => s.id !== action.setId) } : e,
        ),
      };

    case 'updateSet':
      return mapSet(state, action.setId, (s) => ({ ...s, ...action.patch }));

    case 'toggleSet': {
      const found = findSet(state, action.setId);
      if (!found) return state;
      const completing = found.set.completedAt === null;
      const next = mapSet(state, action.setId, (s, e) => {
        if (!completing) return { ...s, completedAt: null };
        // Ticking an empty set copies "vorige keer" so one tap logs it.
        const idx = e.sets.findIndex((x) => x.id === s.id);
        const prev = e.previous[idx];
        return {
          ...s,
          weightKg: s.weightKg ?? prev?.weightKg ?? null,
          reps: s.reps ?? prev?.reps ?? null,
          completedAt: action.now,
        };
      });
      if (!completing) return next;
      const rest = found.exercise.restSeconds;
      return rest > 0
        ? { ...next, restEndsAt: action.now + rest * 1000, restDurationSeconds: rest }
        : { ...next, restEndsAt: null, restDurationSeconds: null };
    }

    case 'setRestSeconds': {
      const seconds = Math.max(0, Math.min(15 * 60, Math.round(action.seconds)));
      return {
        ...state,
        exercises: state.exercises.map((e) => (e.exerciseId === action.exerciseId ? { ...e, restSeconds: seconds } : e)),
      };
    }

    case 'adjustRest': {
      if (state.restEndsAt === null) return state;
      const restEndsAt = state.restEndsAt + action.deltaSeconds * 1000;
      if (restEndsAt <= action.now) return { ...state, restEndsAt: null, restDurationSeconds: null };
      return {
        ...state,
        restEndsAt,
        restDurationSeconds: Math.max(1, (state.restDurationSeconds ?? 0) + action.deltaSeconds),
      };
    }

    case 'skipRest':
      return { ...state, restEndsAt: null, restDurationSeconds: null };

    case 'end':
      return null;
  }
}

/** Remaining rest in ms (0 when no timer or finished). */
export function restRemainingMs(state: ActiveWorkoutState | null, now: number): number {
  if (!state || state.restEndsAt === null) return 0;
  return Math.max(0, state.restEndsAt - now);
}

export function completedSetCount(state: ActiveWorkoutState): number {
  return state.exercises.reduce((n, e) => n + e.sets.filter((s) => s.completedAt !== null).length, 0);
}
