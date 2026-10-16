import type { SetType } from '@/lib/db';

import { MONTHS_NL, formatKg } from './format';

/**
 * Per-exercise progress (Voortgang → Oefening). Pure, framework-free. Weights in kg.
 *
 * Rules:
 * - Warm-up sets are ignored everywhere (e1RM, heaviest set, volume).
 * - Estimated 1RM uses Epley and only sets of 1–10 reps (higher reps overestimate).
 * - PR points: a session whose best e1RM beats every EARLIER session. The very first
 *   session is a baseline, not a PR. PRs are computed over the full history, so
 *   narrowing the period never invents new PRs.
 */

export const E1RM_MIN_REPS = 1;
export const E1RM_MAX_REPS = 10;

/** Epley: w × (1 + reps / 30); 1 rep = the weight itself. Null outside 1–10 reps or w ≤ 0. */
export function epley1rm(weightKg: number | null | undefined, reps: number | null | undefined): number | null {
  if (weightKg == null || reps == null) return null;
  if (!Number.isFinite(weightKg) || !Number.isInteger(reps)) return null;
  if (weightKg <= 0 || reps < E1RM_MIN_REPS || reps > E1RM_MAX_REPS) return null;
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30);
}

/** One completed set of a finished workout (see data/queries.ts). */
export interface ExerciseSetRow {
  workout_id: string;
  started_at: string;
  set_type: SetType;
  weight_kg: number | null;
  reps: number | null;
}

export interface SetRef {
  weightKg: number;
  reps: number;
}

export interface SessionStat {
  workoutId: string;
  startedAt: string;
  /** Best Epley e1RM of the session (1–10 rep sets), null when no set qualifies. */
  e1rm: number | null;
  /** Heaviest working set (highest weight, then most reps). */
  heaviest: SetRef | null;
  /** Σ kg × reps over working sets. */
  volumeKg: number;
  /** New best e1RM compared with all earlier sessions. */
  pr: boolean;
}

const isWorking = (r: ExerciseSetRow) =>
  r.set_type !== 'warmup' && r.weight_kg != null && r.reps != null && r.weight_kg > 0 && r.reps > 0;

/** Groups set rows into sessions (oldest first) and flags PR sessions. */
export function buildSessions(rows: readonly ExerciseSetRow[]): SessionStat[] {
  const byWorkout = new Map<string, SessionStat>();
  for (const r of rows) {
    let s = byWorkout.get(r.workout_id);
    if (!s) {
      s = { workoutId: r.workout_id, startedAt: r.started_at, e1rm: null, heaviest: null, volumeKg: 0, pr: false };
      byWorkout.set(r.workout_id, s);
    }
    if (!isWorking(r)) continue;
    const w = r.weight_kg as number;
    const reps = r.reps as number;
    s.volumeKg += w * reps;
    const e = epley1rm(w, reps);
    if (e !== null && (s.e1rm === null || e > s.e1rm)) s.e1rm = e;
    if (!s.heaviest || w > s.heaviest.weightKg || (w === s.heaviest.weightKg && reps > s.heaviest.reps)) {
      s.heaviest = { weightKg: w, reps };
    }
  }
  const sessions = [...byWorkout.values()]
    .filter((s) => s.heaviest !== null)
    .sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
  let best: number | null = null;
  for (const s of sessions) {
    if (s.e1rm === null) continue;
    s.pr = best !== null && s.e1rm > best + 1e-9;
    if (best === null || s.e1rm > best) best = s.e1rm;
  }
  return sessions;
}

export type ProgressPeriod = '3m' | '6m' | '1y' | 'all';

export const PERIODS: readonly { value: ProgressPeriod; label: string; words: string }[] = [
  { value: '3m', label: '3 mnd', words: 'in drie maanden' },
  { value: '6m', label: '6 mnd', words: 'in zes maanden' },
  { value: '1y', label: '1 jaar', words: 'in een jaar' },
  { value: 'all', label: 'Alles', words: 'sinds je eerste training' },
];

const PERIOD_MONTHS: Record<Exclude<ProgressPeriod, 'all'>, number> = { '3m': 3, '6m': 6, '1y': 12 };

/** Start of the period (local time), or null for "all". */
export function periodStart(period: ProgressPeriod, now: Date): Date | null {
  if (period === 'all') return null;
  const d = new Date(now.getTime());
  d.setMonth(d.getMonth() - PERIOD_MONTHS[period]);
  return d;
}

export function filterByPeriod<T extends { startedAt: string }>(items: readonly T[], period: ProgressPeriod, now: Date): T[] {
  const start = periodStart(period, now);
  if (!start) return [...items];
  const t = start.getTime();
  return items.filter((i) => Date.parse(i.startedAt) >= t);
}

export interface ExerciseSummary {
  /** Sessions with an e1RM, oldest first: the chart points. */
  points: { value: number; pr: boolean; startedAt: string }[];
  latestE1rm: number | null;
  /** latest − first e1RM in the period; null with fewer than 2 points. */
  deltaE1rm: number | null;
  heaviest: SetRef | null;
  bestVolumeKg: number | null;
  prCount: number;
}

/** Headline numbers for one exercise over the given sessions (already period-filtered). */
export function summarizeExercise(sessions: readonly SessionStat[]): ExerciseSummary {
  const points = sessions
    .filter((s): s is SessionStat & { e1rm: number } => s.e1rm !== null)
    .map((s) => ({ value: s.e1rm, pr: s.pr, startedAt: s.startedAt }));
  const first = points[0];
  const last = points[points.length - 1];
  let heaviest: SetRef | null = null;
  let bestVolumeKg: number | null = null;
  for (const s of sessions) {
    const h = s.heaviest;
    if (h && (!heaviest || h.weightKg > heaviest.weightKg || (h.weightKg === heaviest.weightKg && h.reps > heaviest.reps))) {
      heaviest = h;
    }
    if (s.volumeKg > 0 && (bestVolumeKg === null || s.volumeKg > bestVolumeKg)) bestVolumeKg = s.volumeKg;
  }
  return {
    points,
    latestE1rm: last?.value ?? null,
    deltaE1rm: first && last && points.length > 1 ? last.value - first.value : null,
    heaviest,
    bestVolumeKg,
    prCount: points.filter((p) => p.pr).length,
  };
}

/**
 * X-axis labels: the month name at the first point of each month, thinned so labels
 * never sit closer than ~1/5 of the chart apart. Empty string = no label.
 */
export function monthLabels(dates: readonly string[], maxLabels = 5): string[] {
  const out = dates.map(() => '');
  if (dates.length === 0) return out;
  const minGap = Math.max(1, Math.ceil(dates.length / maxLabels));
  let prevMonth = -1;
  let lastIdx = -Infinity;
  dates.forEach((iso, i) => {
    const d = new Date(iso);
    const key = d.getFullYear() * 12 + d.getMonth();
    if (key !== prevMonth && i - lastIdx >= minGap) {
      out[i] = MONTHS_NL[d.getMonth()] ?? '';
      lastIdx = i;
    }
    prevMonth = key;
  });
  return out;
}

/** One-sentence chart summary for screen readers (hard requirement for every chart). */
export function trendSentence(exerciseName: string, summary: ExerciseSummary, period: ProgressPeriod): string {
  const words = PERIODS.find((p) => p.value === period)?.words ?? '';
  const { points, prCount } = summary;
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return `Nog geen geschat 1RM voor ${exerciseName} ${words}.`;
  if (points.length === 1) return `Geschat 1RM ${exerciseName}: ${formatKg(last.value)} kilo, één training ${words}.`;
  const from = formatKg(first.value);
  const to = formatKg(last.value);
  const verb = from === to ? `blijft ${to} kilo` : last.value > first.value ? `stijgt van ${from} naar ${to} kilo` : `daalt van ${from} naar ${to} kilo`;
  const prs = prCount === 0 ? '' : prCount === 1 ? ', met één persoonlijk record' : `, met ${prCount} persoonlijke records`;
  return `Geschat 1RM ${exerciseName} ${verb} ${words}${prs}.`;
}
