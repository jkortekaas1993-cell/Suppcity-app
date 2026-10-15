import * as Notifications from 'expo-notifications';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import { Vibration } from 'react-native';

import { newId, nowIso, useRepositories, type Repositories, type SetType, type WorkoutSet } from '@/lib/db';

import {
  activeWorkoutReducer,
  DEFAULT_REST_SECONDS,
  type ActiveWorkoutAction,
  type ActiveWorkoutState,
  type NewExerciseInput,
  type PreviousSetValue,
} from './logic/activeWorkoutReducer';

export type { ActiveWorkoutState } from './logic/activeWorkoutReducer';

/**
 * The in-progress workout: React context + the pure reducer in
 * logic/activeWorkoutReducer.ts. Feeds ActiveWorkoutBar on every tab.
 *
 * Persistence (offline-first, crash-safe):
 * - The workout row is inserted when the workout starts (ended_at NULL).
 * - Every change is snapshotted to the local-only `app_state` table, so a
 *   killed app resumes the workout. Ticked sets are written to `sets`
 *   right away (via SetRepository); unticked/removed sets are soft-deleted.
 * - Finishing stamps ended_at; only ticked sets are kept.
 */

const SNAPSHOT_KEY = 'tracker.activeWorkout';
const REST_PREFS_KEY = 'tracker.restSeconds';
const PERSIST_DEBOUNCE_MS = 300;

export interface ActiveWorkoutActions {
  startEmpty(): Promise<void>;
  startFromRoutine(routineId: string): Promise<void>;
  addExercise(exerciseId: string): Promise<void>;
  removeExercise(exerciseId: string): void;
  addSet(exerciseId: string): void;
  removeSet(setId: string): void;
  updateSet(setId: string, patch: { weightKg?: number | null; reps?: number | null; setType?: SetType }): void;
  toggleSet(setId: string): void;
  setRestSeconds(exerciseId: string, seconds: number): void;
  adjustRest(deltaSeconds: number): void;
  skipRest(): void;
  rename(title: string): void;
  /** Saves ticked sets, closes the workout and returns its id. */
  finish(): Promise<string | null>;
  /** Deletes the workout without saving. */
  discard(): Promise<void>;
}

const StateContext = createContext<ActiveWorkoutState | null>(null);
const ActionsContext = createContext<ActiveWorkoutActions | null>(null);

async function loadPrevious(repos: Repositories, exerciseId: string): Promise<PreviousSetValue[]> {
  const prev = await repos.sets.previousFor(exerciseId);
  return (prev?.sets ?? [])
    .filter((s) => s.set_type !== 'warmup')
    .map((s) => ({ weightKg: s.weight_kg, reps: s.reps }));
}

function defaultTitle(date = new Date()): string {
  const h = date.getHours();
  const part = h < 12 ? 'Ochtendtraining' : h < 18 ? 'Middagtraining' : 'Avondtraining';
  return part;
}

function toSetRows(state: ActiveWorkoutState): (Omit<WorkoutSet, 'created_at' | 'updated_at' | 'deleted_at' | 'user_id'>)[] {
  const rows: Omit<WorkoutSet, 'created_at' | 'updated_at' | 'deleted_at' | 'user_id'>[] = [];
  for (const e of state.exercises) {
    for (const s of e.sets) {
      if (s.completedAt === null) continue;
      rows.push({
        id: s.id,
        workout_id: state.workoutId,
        exercise_id: e.exerciseId,
        position: s.position,
        set_type: s.setType,
        weight_kg: s.weightKg,
        reps: s.reps,
        rpe: null,
        completed_at: new Date(s.completedAt).toISOString(),
      });
    }
  }
  return rows;
}

async function notificationsAllowed(): Promise<boolean> {
  try {
    // Never ask here: permission is requested elsewhere after the first finished workout (ADR-9).
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

export interface ActiveWorkoutProviderProps {
  children: ReactNode;
  /**
   * Called (fire-and-forget) after a workout is finished and stored locally. The app
   * shell uses it to sync and then claim workout points; the tracker itself never
   * imports sync or points. Errors are swallowed: the workout is already saved.
   */
  onWorkoutFinished?: (workoutId: string) => void | Promise<void>;
}

export function ActiveWorkoutProvider({ children, onWorkoutFinished }: ActiveWorkoutProviderProps) {
  const repos = useRepositories();
  const onFinishedRef = useRef(onWorkoutFinished);
  onFinishedRef.current = onWorkoutFinished;
  const [state, dispatch] = useReducer(activeWorkoutReducer, null);
  const stateRef = useRef<ActiveWorkoutState | null>(null);
  stateRef.current = state;
  const hydrated = useRef(false);
  const persistedSetIds = useRef<Set<string>>(new Set());
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistChain = useRef<Promise<void>>(Promise.resolve());
  const restNotificationId = useRef<string | null>(null);

  // --- hydrate after app start ---------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const snapshot = await repos.appState.get<ActiveWorkoutState>(SNAPSHOT_KEY);
      if (cancelled) return;
      if (snapshot && Array.isArray(snapshot.exercises)) {
        persistedSetIds.current = new Set(toSetRows(snapshot).map((r) => r.id));
        dispatch({ type: 'hydrate', state: snapshot });
      }
      hydrated.current = true;
    })().catch((err: unknown) => {
      hydrated.current = true;
      console.warn('Kon actieve training niet herstellen', err);
    });
    return () => {
      cancelled = true;
    };
  }, [repos]);

  // --- persist (debounced, serialized) ----------------------------------------------
  const persistNow = useCallback((): Promise<void> => {
    const snapshot = stateRef.current;
    const run = async () => {
      if (!snapshot) return;
      const rows = toSetRows(snapshot);
      const current = new Set(rows.map((r) => r.id));
      const removed = [...persistedSetIds.current].filter((id) => !current.has(id));
      await repos.sets.upsertMany(rows);
      await repos.sets.softDeleteMany(removed);
      persistedSetIds.current = current;
      await repos.appState.set(SNAPSHOT_KEY, snapshot);
    };
    persistChain.current = persistChain.current.then(run, run).catch((err: unknown) => {
      console.warn('Opslaan van training mislukt', err);
    });
    return persistChain.current;
  }, [repos]);

  useEffect(() => {
    if (!hydrated.current || !state) return;
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => void persistNow(), PERSIST_DEBOUNCE_MS);
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, [state, persistNow]);

  // --- rest timer: local notification + in-app vibration -------------------------
  const restEndsAt = state?.restEndsAt ?? null;
  useEffect(() => {
    let cancelled = false;
    const previous = restNotificationId.current;
    restNotificationId.current = null;
    if (previous) void Notifications.cancelScheduledNotificationAsync(previous).catch(() => undefined);
    if (restEndsAt === null) return;
    const ms = restEndsAt - Date.now();
    if (ms <= 0) return;

    const timeout = setTimeout(() => {
      Vibration.vibrate(400);
      dispatch({ type: 'skipRest' });
    }, ms);

    void (async () => {
      if (!(await notificationsAllowed()) || cancelled) return;
      const id = await Notifications.scheduleNotificationAsync({
        content: { title: 'Rust voorbij', body: 'Tijd voor je volgende set.', sound: true },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: Math.max(1, Math.round(ms / 1000)),
          repeats: false,
        },
      });
      if (cancelled) void Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined);
      else restNotificationId.current = id;
    })().catch(() => undefined);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      const id = restNotificationId.current;
      restNotificationId.current = null;
      if (id) void Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined);
    };
  }, [restEndsAt]);

  // --- actions -------------------------------------------------------------------------
  const actions = useMemo<ActiveWorkoutActions>(() => {
    const send = (a: ActiveWorkoutAction) => dispatch(a);

    async function restPrefs(): Promise<Record<string, number>> {
      return (await repos.appState.get<Record<string, number>>(REST_PREFS_KEY)) ?? {};
    }

    async function begin(title: string, routineId: string | null, exercises: NewExerciseInput[]) {
      if (stateRef.current) return; // one workout at a time
      const startedAt = Date.now();
      const workout = await repos.workouts.start({
        id: newId(),
        routine_id: routineId,
        title,
        started_at: new Date(startedAt).toISOString(),
        ended_at: null,
        notes: null,
        source: 'app',
      });
      persistedSetIds.current = new Set();
      send({ type: 'start', workoutId: workout.id, title, routineId, startedAt, exercises });
    }

    return {
      async startEmpty() {
        await begin(defaultTitle(), null, []);
      },

      async startFromRoutine(routineId) {
        const found = await repos.routines.get(routineId);
        if (!found) return;
        const inputs: NewExerciseInput[] = [];
        for (const re of found.exercises) {
          const exercise = await repos.exercises.get(re.exercise_id);
          if (!exercise || exercise.deleted_at) continue;
          inputs.push({
            exerciseId: exercise.id,
            name: exercise.name_nl,
            restSeconds: re.rest_seconds,
            targetRepsMin: re.target_reps_min,
            targetRepsMax: re.target_reps_max,
            previous: await loadPrevious(repos, exercise.id),
            setIds: Array.from({ length: re.target_sets }, () => newId()),
          });
        }
        await begin(found.routine.name, routineId, inputs);
      },

      async addExercise(exerciseId) {
        const current = stateRef.current;
        if (!current || current.exercises.some((e) => e.exerciseId === exerciseId)) return;
        const exercise = await repos.exercises.get(exerciseId);
        if (!exercise) return;
        const previous = await loadPrevious(repos, exerciseId);
        const prefs = await restPrefs();
        send({
          type: 'addExercise',
          exercise: {
            exerciseId,
            name: exercise.name_nl,
            restSeconds: prefs[exerciseId] ?? DEFAULT_REST_SECONDS,
            previous,
            setIds: Array.from({ length: Math.max(1, previous.length) }, () => newId()),
          },
        });
      },

      removeExercise: (exerciseId) => send({ type: 'removeExercise', exerciseId }),
      addSet: (exerciseId) => send({ type: 'addSet', exerciseId, setId: newId() }),
      removeSet: (setId) => send({ type: 'removeSet', setId }),
      updateSet: (setId, patch) => send({ type: 'updateSet', setId, patch }),
      toggleSet: (setId) => send({ type: 'toggleSet', setId, now: Date.now() }),
      setRestSeconds(exerciseId, seconds) {
        send({ type: 'setRestSeconds', exerciseId, seconds });
        void restPrefs()
          .then((prefs) => repos.appState.set(REST_PREFS_KEY, { ...prefs, [exerciseId]: seconds }))
          .catch(() => undefined);
      },
      adjustRest: (deltaSeconds) => send({ type: 'adjustRest', deltaSeconds, now: Date.now() }),
      skipRest: () => send({ type: 'skipRest' }),
      rename(title) {
        const t = title.trim();
        if (!t) return;
        send({ type: 'rename', title: t });
      },

      async finish() {
        const current = stateRef.current;
        if (!current) return null;
        if (persistTimer.current) clearTimeout(persistTimer.current);
        await persistNow();
        await repos.workouts.update(current.workoutId, { title: current.title });
        await repos.workouts.finish(current.workoutId, nowIso());
        await repos.appState.remove(SNAPSHOT_KEY);
        persistedSetIds.current = new Set();
        send({ type: 'end' });
        const hook = onFinishedRef.current;
        if (hook) void Promise.resolve().then(() => hook(current.workoutId)).catch(() => undefined);
        return current.workoutId;
      },

      async discard() {
        const current = stateRef.current;
        if (!current) return;
        if (persistTimer.current) clearTimeout(persistTimer.current);
        await persistChain.current;
        await repos.workouts.softDelete(current.workoutId);
        await repos.appState.remove(SNAPSHOT_KEY);
        persistedSetIds.current = new Set();
        send({ type: 'end' });
      },
    };
  }, [repos, persistNow]);

  return (
    <ActionsContext.Provider value={actions}>
      <StateContext.Provider value={state}>{children}</StateContext.Provider>
    </ActionsContext.Provider>
  );
}

/** Current in-progress workout, or null. */
export function useActiveWorkout(): ActiveWorkoutState | null {
  return useContext(StateContext);
}

export function useActiveWorkoutActions(): ActiveWorkoutActions {
  const actions = useContext(ActionsContext);
  if (!actions) throw new Error('useActiveWorkoutActions must be used inside <ActiveWorkoutProvider>');
  return actions;
}
