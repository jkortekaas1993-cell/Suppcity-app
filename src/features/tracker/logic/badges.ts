import type { SetType } from '@/lib/db/types';

import { setVolume } from './oneRepMax';
import { detectPrs, type PrSetInput } from './prs';
import { clampWeeklyGoal, weekIndex } from './week';

/**
 * Milestones ("Mijlpalen"). Pure and deterministic: the same local training
 * history always yields the same badges with the same earned moment.
 *
 * HARD RULES 1 and 5: badges are a local, symbolic reward. They are never
 * linked to points, discounts, prizes, marketing or segmentation, and they are
 * not sent to Shopify or any marketing tool. No chance mechanics, no daily
 * streaks: the only streak is "weekly goal 4 weeks in a row".
 */

export type BadgeId =
  | 'first_workout'
  | 'workouts_10'
  | 'workouts_50'
  | 'workouts_100'
  | 'first_pr'
  | 'bench_100'
  | 'squat_100'
  | 'deadlift_100'
  | 'weekly_goal_4_weeks'
  | 'volume_10t_week';

export type BadgeTone = 'gold' | 'accent';

export interface BadgeDefinition {
  id: BadgeId;
  /** Short name under the medal ("Honderd"). */
  title: string;
  /** One line: what you did ("Eerste keer 100 kg op de bank"). */
  description: string;
  /** Text inside the medal ("100", "50×"), or null to draw `icon`. */
  glyph: string | null;
  icon: 'trophy' | 'calendar' | 'star' | null;
  /** gold = strength records; accent = consistency. */
  tone: BadgeTone;
}

/** Display order = catalogue order. Copy is Dutch (UI language). */
export const BADGES: readonly BadgeDefinition[] = [
  { id: 'first_workout', title: 'Eerste workout', description: 'Je eerste training afgerond', glyph: '1', icon: null, tone: 'accent' },
  { id: 'workouts_10', title: '10 workouts', description: '10 trainingen afgerond', glyph: '10×', icon: null, tone: 'accent' },
  { id: 'workouts_50', title: '50 workouts', description: '50 trainingen afgerond', glyph: '50×', icon: null, tone: 'accent' },
  { id: 'workouts_100', title: '100 workouts', description: '100 trainingen afgerond', glyph: '100×', icon: null, tone: 'accent' },
  { id: 'first_pr', title: 'Eerste PR', description: 'Je eerste persoonlijk record', glyph: null, icon: 'trophy', tone: 'gold' },
  { id: 'bench_100', title: 'Honderd', description: 'Eerste keer 100 kg op de bank', glyph: '100', icon: null, tone: 'gold' },
  { id: 'squat_100', title: 'Squat 100', description: 'Eerste keer 100 kg squat', glyph: '100', icon: null, tone: 'gold' },
  { id: 'deadlift_100', title: 'Deadlift 100', description: 'Eerste keer 100 kg deadlift', glyph: '100', icon: null, tone: 'gold' },
  {
    id: 'weekly_goal_4_weeks',
    title: '4 weken op schema',
    description: '4 weken op rij je weekdoel gehaald',
    glyph: null,
    icon: 'calendar',
    tone: 'accent',
  },
  { id: 'volume_10t_week', title: '10 ton in 1 week', description: '10.000 kg volume in één week', glyph: '10T', icon: null, tone: 'accent' },
];

export const BADGE_BY_ID: ReadonlyMap<BadgeId, BadgeDefinition> = new Map(BADGES.map((b) => [b.id, b]));

export function isBadgeId(v: string): v is BadgeId {
  return BADGE_BY_ID.has(v as BadgeId);
}

/** Built-in exercise slugs that count for the 100 kg badges (barbell lifts only). */
export const HUNDRED_KG_EXERCISES: Readonly<Record<'bench_100' | 'squat_100' | 'deadlift_100', readonly string[]>> = {
  bench_100: ['bench-press-barbell'],
  squat_100: ['squat-barbell'],
  deadlift_100: ['deadlift-barbell', 'sumo-deadlift-barbell'],
};

const HUNDRED_KG = 100;
const TEN_TONNES_KG = 10_000;
const WEEK_STREAK = 4;
const WORKOUT_COUNTS: readonly [number, BadgeId][] = [
  [1, 'first_workout'],
  [10, 'workouts_10'],
  [50, 'workouts_50'],
  [100, 'workouts_100'],
];

export interface BadgeSetInput {
  exerciseId: string;
  setType: SetType;
  weightKg: number | null;
  reps: number | null;
}

/** A finished workout with its completed sets. */
export interface BadgeWorkoutInput {
  id: string;
  startedAt: string;
  /** Finish moment; the badge's earned_at. Falls back to startedAt. */
  endedAt: string | null;
  sets: readonly BadgeSetInput[];
}

export interface EarnedBadge {
  badgeId: BadgeId;
  /** ISO moment the badge was earned (end of the triggering workout). */
  earnedAt: string;
  /** Workout that earned it. */
  sourceRef: string;
}

function isWorking(s: BadgeSetInput): boolean {
  return s.setType !== 'warmup' && (s.reps ?? 0) > 0;
}

/**
 * A weekly-goal change: from week `week` (weekIndex, Monday-based ISO week, local) on,
 * the goal is `goal`. `key` ("2026-W42") and `from` (Monday, YYYY-MM-DD) are for the
 * CSV export. Week 0 means "since the start" (the goal before the first change).
 */
export interface WeeklyGoalChange {
  week: number;
  key: string;
  from: string;
  goal: number;
}

/** Goal that applied in `week`: the last change at or before it (history sorted by week). */
export function goalForWeek(history: readonly WeeklyGoalChange[], currentGoal: number, week: number): number {
  let goal: number | null = null;
  for (const h of history) {
    if (h.week <= week) goal = h.goal;
    else break;
  }
  return clampWeeklyGoal(goal ?? history[0]?.goal ?? currentGoal);
}

/**
 * Records a goal change in week `at` (no retroactive effect): before the first change the
 * previous goal is kept as "since the start"; a second change in the same week replaces it.
 */
export function recordGoalChange(
  history: readonly WeeklyGoalChange[],
  previousGoal: number,
  change: WeeklyGoalChange,
): WeeklyGoalChange[] {
  const base: WeeklyGoalChange[] =
    history.length > 0 ? [...history] : [{ week: 0, key: '', from: '', goal: clampWeeklyGoal(previousGoal) }];
  const kept = base.filter((h) => h.week < change.week).sort((a, b) => a.week - b.week);
  const before = kept[kept.length - 1];
  if (before && before.goal === change.goal) return kept; // back to the goal that applied anyway
  return [...kept, { ...change, goal: clampWeeklyGoal(change.goal) }];
}

/** Parses the stored history; drops anything malformed. */
export function parseGoalHistory(raw: unknown): WeeklyGoalChange[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (h): h is WeeklyGoalChange =>
        typeof h === 'object' &&
        h !== null &&
        Number.isInteger((h as WeeklyGoalChange).week) &&
        typeof (h as WeeklyGoalChange).goal === 'number' &&
        typeof (h as WeeklyGoalChange).key === 'string' &&
        typeof (h as WeeklyGoalChange).from === 'string',
    )
    .map((h) => ({ week: h.week, key: h.key, from: h.from, goal: clampWeeklyGoal(h.goal) }))
    .sort((a, b) => a.week - b.week);
}

/**
 * Every badge earned by this history, each at the first workout that earned it.
 * `weeklyGoal` is the user's current weekly goal (1–5); `goalHistory` (optional) the goal
 * that applied per week, so changing the goal never rewrites past weeks.
 */
export function evaluateBadges(
  workouts: readonly BadgeWorkoutInput[],
  opts: { weeklyGoal: number; goalHistory?: readonly WeeklyGoalChange[] },
): EarnedBadge[] {
  const history = opts.goalHistory ?? [];
  const goalOf = (week: number) => (history.length > 0 ? goalForWeek(history, opts.weeklyGoal, week) : clampWeeklyGoal(opts.weeklyGoal));
  const ordered = [...workouts]
    .filter((w) => Number.isFinite(Date.parse(w.startedAt)))
    .sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt) || a.id.localeCompare(b.id));

  const earned = new Map<BadgeId, EarnedBadge>();
  const award = (badgeId: BadgeId, w: BadgeWorkoutInput) => {
    if (!earned.has(badgeId)) earned.set(badgeId, { badgeId, earnedAt: w.endedAt ?? w.startedAt, sourceRef: w.id });
  };

  // History per exercise for PR detection (only exercises in the current workout are compared).
  const historyByExercise = new Map<string, PrSetInput[]>();
  const perWeek = new Map<number, number>();
  const volumePerWeek = new Map<number, number>();
  let count = 0;

  for (const w of ordered) {
    count += 1;
    for (const [n, id] of WORKOUT_COUNTS) if (count >= n) award(id, w);

    const working = w.sets.filter(isWorking);

    // 100 kg on bench / squat / deadlift.
    for (const [badge, slugs] of Object.entries(HUNDRED_KG_EXERCISES) as [keyof typeof HUNDRED_KG_EXERCISES, readonly string[]][]) {
      if (working.some((s) => slugs.includes(s.exerciseId) && (s.weightKg ?? 0) >= HUNDRED_KG)) award(badge, w);
    }

    // First PR: same rules as the summary screen (needs earlier history for that exercise).
    const current: PrSetInput[] = w.sets.map((s) => ({ workoutId: w.id, exerciseId: s.exerciseId, setType: s.setType, weightKg: s.weightKg, reps: s.reps, completed: true }));
    if (!earned.has('first_pr')) {
      const ids = new Set(current.map((s) => s.exerciseId));
      const history: PrSetInput[] = [];
      for (const id of ids) history.push(...(historyByExercise.get(id) ?? []));
      if (history.length > 0 && detectPrs(history, current).length > 0) award('first_pr', w);
    }
    for (const s of current) {
      const list = historyByExercise.get(s.exerciseId) ?? [];
      list.push(s);
      historyByExercise.set(s.exerciseId, list);
    }

    // Weekly volume and weekly goal streak.
    const week = weekIndex(w.startedAt);
    const volume = (volumePerWeek.get(week) ?? 0) + working.reduce((sum, s) => sum + setVolume(s.weightKg, s.reps), 0);
    volumePerWeek.set(week, volume);
    if (volume >= TEN_TONNES_KG) award('volume_10t_week', w);

    const inWeek = (perWeek.get(week) ?? 0) + 1;
    perWeek.set(week, inWeek);
    if (inWeek === goalOf(week) && !earned.has('weekly_goal_4_weeks')) {
      // This workout completed the goal for `week`: count consecutive completed weeks ending
      // here, each against the goal that applied in THAT week.
      let streak = 1;
      while (streak < WEEK_STREAK && (perWeek.get(week - streak) ?? 0) >= goalOf(week - streak)) streak += 1;
      if (streak >= WEEK_STREAK) award('weekly_goal_4_weeks', w);
    }
  }

  return BADGES.map((b) => earned.get(b.id)).filter((e): e is EarnedBadge => e !== undefined);
}

/** Badges in `evaluated` that are not stored yet (earned badges are never taken away). */
export function newlyEarned(evaluated: readonly EarnedBadge[], storedIds: Iterable<string>): EarnedBadge[] {
  const have = new Set(storedIds);
  return evaluated.filter((e) => !have.has(e.badgeId));
}

export interface BadgeView extends BadgeDefinition {
  earned: boolean;
  earnedAt: string | null;
  sourceRef: string | null;
}

/** Full catalogue with the user's earned state, in display order. */
export function badgeViews(stored: readonly { badge_id: string; earned_at: string; source_ref: string | null }[]): BadgeView[] {
  const byId = new Map(stored.map((s) => [s.badge_id, s]));
  return BADGES.map((b) => {
    const s = byId.get(b.id);
    return { ...b, earned: s !== undefined, earnedAt: s?.earned_at ?? null, sourceRef: s?.source_ref ?? null };
  });
}
