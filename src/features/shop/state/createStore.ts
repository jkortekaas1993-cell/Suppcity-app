import { useSyncExternalStore } from 'react';

/** Tiny observable store (same pattern as activeWorkoutStore). */
export function createStore<T>(initial: T) {
  let state = initial;
  const listeners = new Set<() => void>();
  const get = () => state;
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  return {
    get,
    set(patch: Partial<T>) {
      state = { ...state, ...patch };
      listeners.forEach((l) => l());
    },
    subscribe,
    // Closure references, not `this`: stores that spread this object and override
    // `get` (e.g. stockStore.get(id)) must not change what the hook reads.
    use(): T {
      return useSyncExternalStore(subscribe, get, get);
    },
  };
}
