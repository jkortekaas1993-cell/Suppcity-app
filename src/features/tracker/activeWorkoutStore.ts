import { useSyncExternalStore } from 'react';

/**
 * Minimal global store for the in-progress workout, shown by ActiveWorkoutBar
 * on every tab. Tracker builder: replace internals (e.g. persist to SQLite so a
 * crash/kill never loses a workout), but keep the exported API stable.
 */
export interface ActiveWorkoutState {
  workoutId: string;
  title: string;
  startedAt: number; // epoch ms
  /** When a rest timer is running: epoch ms at which it ends. */
  restEndsAt: number | null;
}

type Listener = () => void;

let state: ActiveWorkoutState | null = null;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l());
}

export const activeWorkout = {
  get: (): ActiveWorkoutState | null => state,
  start: (next: ActiveWorkoutState) => {
    state = next;
    emit();
  },
  update: (patch: Partial<ActiveWorkoutState>) => {
    if (!state) return;
    state = { ...state, ...patch };
    emit();
  },
  finish: () => {
    state = null;
    emit();
  },
  subscribe: (listener: Listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useActiveWorkout(): ActiveWorkoutState | null {
  return useSyncExternalStore(activeWorkout.subscribe, activeWorkout.get, activeWorkout.get);
}
