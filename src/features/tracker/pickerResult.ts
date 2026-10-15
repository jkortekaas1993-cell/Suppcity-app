/**
 * Tiny hand-off channel from the exercise picker back to the routine editor
 * (expo-router has no "return value" for pushed screens).
 */
let pending: string | null = null;

export const pickerResult = {
  set(id: string) {
    pending = id;
  },
  /** Returns and clears the picked id. */
  take(): string | null {
    const v = pending;
    pending = null;
    return v;
  },
};
