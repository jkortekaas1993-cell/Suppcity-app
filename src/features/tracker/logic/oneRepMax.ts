/**
 * Strength maths. Pure, framework-free. All weights in kg.
 */

/**
 * Estimated one-rep max via the Epley formula: w × (1 + reps / 30).
 * A single rep returns the weight itself. Invalid input returns null.
 */
export function epley1rm(weightKg: number | null | undefined, reps: number | null | undefined): number | null {
  if (weightKg == null || reps == null) return null;
  if (!Number.isFinite(weightKg) || !Number.isFinite(reps)) return null;
  if (weightKg <= 0 || reps <= 0) return null;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

/** Volume of one set (kg × reps). Missing values count as zero. */
export function setVolume(weightKg: number | null | undefined, reps: number | null | undefined): number {
  if (weightKg == null || reps == null) return 0;
  if (!Number.isFinite(weightKg) || !Number.isFinite(reps) || weightKg <= 0 || reps <= 0) return 0;
  return weightKg * reps;
}

/** Rounds to `decimals` places without float noise (e.g. 0.1 + 0.2). */
export function round(value: number, decimals = 1): number {
  const f = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * f) / f;
}
