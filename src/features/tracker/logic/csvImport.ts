import { z } from 'zod';

import type { SetType, WorkoutSource } from '@/lib/db/types';

import { parseCsvObjects } from './csv';

/**
 * Pure parsers for Hevy and Strong CSV exports. Output is app-neutral; the
 * repository maps exercise names to ids and writes rows.
 * All external data is validated with zod at this boundary.
 */

export const LB_TO_KG = 0.45359237;

export interface ImportedSet {
  exerciseName: string;
  position: number;
  setType: SetType;
  weightKg: number | null;
  reps: number | null;
  rpe: number | null;
}

export interface ImportedWorkout {
  title: string;
  /** ISO-8601 UTC. */
  startedAt: string;
  endedAt: string | null;
  notes: string | null;
  source: WorkoutSource;
  sets: ImportedSet[];
}

export interface ImportResult {
  workouts: ImportedWorkout[];
  /** Human-readable warnings (Dutch, shown in UI), e.g. skipped rows. */
  warnings: string[];
}

export type CsvFormat = 'hevy' | 'strong';

export class CsvImportError extends Error {}

// --- number/date helpers --------------------------------------------------

function num(text: string | undefined): number | null {
  if (text == null) return null;
  const t = text.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function nonNegative(n: number | null): number | null {
  return n !== null && n >= 0 ? n : null;
}

function roundKg(kg: number): number {
  return Math.round(kg * 100) / 100;
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, mrt: 2, apr: 3, may: 4, mei: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, okt: 9, nov: 10, dec: 11,
};

/**
 * Parses the date formats Hevy and Strong use, in local time:
 * - "26 Jan 2024, 18:05" (Hevy)
 * - "2024-01-26 18:05:00" / "2024-01-26 18:05" (Strong)
 * - full ISO strings with zone (returned as-is)
 */
export function parseExportDate(text: string): Date | null {
  const t = text.trim();
  if (t === '') return null;
  let m = /^(\d{1,2}) ([A-Za-z]{3})[a-z]* (\d{4}),? (\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(t);
  if (m) {
    const month = MONTHS[(m[2] ?? '').toLowerCase()];
    if (month === undefined) return null;
    return new Date(Number(m[3]), month, Number(m[1]), Number(m[4]), Number(m[5]), Number(m[6] ?? 0));
  }
  m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(t);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] ?? 0));
  }
  if (/^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:?\d{2})$/.test(t)) {
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Strong durations: "1h 5m", "45m", "1h", "3600" (seconds), "1:05:00". */
export function parseDurationSeconds(text: string | undefined): number | null {
  if (!text) return null;
  const t = text.trim();
  if (t === '') return null;
  if (/^\d+$/.test(t)) return Number(t);
  const colon = /^(\d+):(\d{2})(?::(\d{2}))?$/.exec(t);
  if (colon) {
    return colon[3] !== undefined
      ? Number(colon[1]) * 3600 + Number(colon[2]) * 60 + Number(colon[3])
      : Number(colon[1]) * 60 + Number(colon[2]);
  }
  const h = /(\d+)\s*h/.exec(t);
  const mm = /(\d+)\s*m(?!s)/.exec(t);
  const s = /(\d+)\s*s/.exec(t);
  if (!h && !mm && !s) return null;
  return Number(h?.[1] ?? 0) * 3600 + Number(mm?.[1] ?? 0) * 60 + Number(s?.[1] ?? 0);
}

// --- format detection -----------------------------------------------------

export function detectCsvFormat(headers: readonly string[]): CsvFormat | null {
  const h = new Set(headers.map((x) => x.toLowerCase()));
  if (h.has('exercise_title') && h.has('start_time')) return 'hevy';
  if (h.has('exercise name') && h.has('set order') && h.has('date')) return 'strong';
  return null;
}

// --- Hevy -----------------------------------------------------------------

const hevyRow = z.object({
  title: z.string().default(''),
  start_time: z.string().min(1),
  end_time: z.string().default(''),
  description: z.string().default(''),
  exercise_title: z.string().min(1),
  set_index: z.string().default(''),
  set_type: z.string().default('normal'),
  weight_kg: z.string().optional(),
  weight_lbs: z.string().optional(),
  reps: z.string().default(''),
  rpe: z.string().default(''),
});

function hevySetType(t: string): SetType {
  const v = t.trim().toLowerCase();
  if (v === 'warmup' || v === 'warm_up' || v === 'warm-up') return 'warmup';
  if (v === 'dropset' || v === 'drop_set' || v === 'drop') return 'dropset';
  if (v === 'failure') return 'failure';
  return 'normal';
}

export function parseHevyCsv(text: string): ImportResult {
  const { headers, records } = parseCsvObjects(text);
  if (detectCsvFormat(headers) !== 'hevy') throw new CsvImportError('Dit lijkt geen Hevy-export te zijn.');
  return groupWorkouts(records, 'import_hevy', (rec, line) => {
    const r = hevyRow.safeParse(rec);
    if (!r.success) return { warning: `Regel ${line} overgeslagen (ontbrekende velden).` };
    const d = r.data;
    const start = parseExportDate(d.start_time);
    if (!start) return { warning: `Regel ${line} overgeslagen (onbekende datum "${d.start_time}").` };
    const end = parseExportDate(d.end_time);
    const lbs = num(d.weight_lbs);
    const kg = num(d.weight_kg) ?? (lbs !== null ? lbs * LB_TO_KG : null);
    const rpe = num(d.rpe);
    return {
      key: `${d.start_time}|${d.title}`,
      workout: {
        title: d.title || 'Workout',
        startedAt: start.toISOString(),
        endedAt: end ? end.toISOString() : null,
        notes: d.description || null,
      },
      set: {
        exerciseName: d.exercise_title.trim(),
        setType: hevySetType(d.set_type),
        weightKg: kg === null ? null : nonNegative(roundKg(kg)),
        reps: nonNegative(num(d.reps)),
        rpe: rpe !== null && rpe >= 1 && rpe <= 10 ? rpe : null,
      },
    };
  });
}

// --- Strong ---------------------------------------------------------------

const strongRow = z.object({
  Date: z.string().min(1),
  'Workout Name': z.string().default(''),
  Duration: z.string().optional(),
  'Workout Duration': z.string().optional(),
  'Exercise Name': z.string().min(1),
  'Set Order': z.string().default(''),
  Weight: z.string().default(''),
  'Weight Unit': z.string().optional(),
  Reps: z.string().default(''),
  RPE: z.string().default(''),
  'Workout Notes': z.string().default(''),
});

function strongSetType(order: string): SetType | 'skip' {
  const v = order.trim().toUpperCase();
  if (v === 'W') return 'warmup';
  if (v === 'D') return 'dropset';
  if (v === 'F') return 'failure';
  if (/^\d+$/.test(v)) return 'normal';
  return 'skip'; // e.g. "Rest Timer" rows
}

export function parseStrongCsv(text: string, opts: { weightUnit?: 'kg' | 'lbs' } = {}): ImportResult {
  const { headers, records } = parseCsvObjects(text);
  if (detectCsvFormat(headers) !== 'strong') throw new CsvImportError('Dit lijkt geen Strong-export te zijn.');
  return groupWorkouts(records, 'import_strong', (rec, line) => {
    const r = strongRow.safeParse(rec);
    if (!r.success) return { warning: `Regel ${line} overgeslagen (ontbrekende velden).` };
    const d = r.data;
    const setType = strongSetType(d['Set Order']);
    if (setType === 'skip') return { skip: true };
    const start = parseExportDate(d.Date);
    if (!start) return { warning: `Regel ${line} overgeslagen (onbekende datum "${d.Date}").` };
    const durationS = parseDurationSeconds(d.Duration ?? d['Workout Duration']);
    const unit = (d['Weight Unit'] ?? opts.weightUnit ?? 'kg').toLowerCase();
    const w = num(d.Weight);
    const kg = w === null ? null : unit.startsWith('lb') ? w * LB_TO_KG : w;
    const rpe = num(d.RPE);
    return {
      key: `${d.Date}|${d['Workout Name']}`,
      workout: {
        title: d['Workout Name'] || 'Workout',
        startedAt: start.toISOString(),
        endedAt: durationS !== null ? new Date(start.getTime() + durationS * 1000).toISOString() : null,
        notes: d['Workout Notes'] || null,
      },
      set: {
        exerciseName: d['Exercise Name'].trim(),
        setType,
        weightKg: kg === null ? null : nonNegative(roundKg(kg)),
        reps: nonNegative(num(d.Reps)),
        rpe: rpe !== null && rpe >= 1 && rpe <= 10 ? rpe : null,
      },
    };
  });
}

// --- shared grouping --------------------------------------------------------

type RowOutcome =
  | { warning: string }
  | { skip: true }
  | {
      key: string;
      workout: Omit<ImportedWorkout, 'sets' | 'source'>;
      set: Omit<ImportedSet, 'position'>;
    };

function groupWorkouts(
  records: Record<string, string>[],
  source: WorkoutSource,
  mapRow: (rec: Record<string, string>, line: number) => RowOutcome,
): ImportResult {
  const warnings: string[] = [];
  const groups = new Map<string, ImportedWorkout>();
  records.forEach((rec, idx) => {
    const out = mapRow(rec, idx + 2); // +1 header, +1 one-based
    if ('warning' in out) {
      warnings.push(out.warning);
      return;
    }
    if ('skip' in out) return;
    let w = groups.get(out.key);
    if (!w) {
      w = { ...out.workout, source, sets: [] };
      groups.set(out.key, w);
    }
    // Position is workout-wide in file order (exercises stay grouped as exported).
    w.sets.push({ ...out.set, position: w.sets.length });
  });
  const workouts = [...groups.values()].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  return { workouts, warnings };
}

/** Detects the format and parses. Throws CsvImportError for unknown files. */
export function parseWorkoutCsv(text: string): ImportResult & { format: CsvFormat } {
  const { headers } = parseCsvObjects(text.split(/\r?\n/, 1)[0] ?? '');
  const format = detectCsvFormat(headers);
  if (format === 'hevy') return { ...parseHevyCsv(text), format };
  if (format === 'strong') return { ...parseStrongCsv(text), format };
  throw new CsvImportError('Onbekend bestand. Exporteer een CSV uit Hevy of Strong en probeer opnieuw.');
}

// --- exercise mapping --------------------------------------------------------

export function normalizeExerciseName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export interface AliasSource {
  id: string;
  name: string;
  aliases?: readonly string[];
}

/** Map of normalized name/alias → exercise id. First definition wins. */
export function buildAliasIndex(sources: readonly AliasSource[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const s of sources) {
    for (const n of [s.name, ...(s.aliases ?? [])]) {
      const key = normalizeExerciseName(n);
      if (key && !index.has(key)) index.set(key, s.id);
    }
  }
  return index;
}

export interface ExerciseMapping {
  /** exact import name → existing exercise id */
  matched: Map<string, string>;
  /** import names without a match; to be created as custom exercises */
  unknown: string[];
}

export function mapExerciseNames(names: Iterable<string>, index: ReadonlyMap<string, string>): ExerciseMapping {
  const matched = new Map<string, string>();
  const unknown: string[] = [];
  const seenUnknown = new Set<string>();
  for (const name of names) {
    if (matched.has(name)) continue;
    const key = normalizeExerciseName(name);
    const id = index.get(key);
    if (id) matched.set(name, id);
    else if (!seenUnknown.has(key)) {
      seenUnknown.add(key);
      unknown.push(name);
    }
  }
  return { matched, unknown };
}
