import type { AppStateRepository, Repositories } from '@/lib/db/repositories';
import type { UserBadge } from '@/lib/db/types';

import {
  BADGE_BY_ID,
  BADGES,
  evaluateBadges,
  isBadgeId,
  newlyEarned,
  parseGoalHistory,
  recordGoalChange,
  type BadgeDefinition,
  type BadgeSetInput,
  type BadgeWorkoutInput,
  type WeeklyGoalChange,
} from '../logic/badges';
import { clampWeeklyGoal, DEFAULT_WEEKLY_GOAL, startOfWeek, weekIndex, weekKey } from '../logic/week';

/** app_state key of the weekly goal (local only, never synced). */
export const WEEKLY_GOAL_KEY = 'tracker.weeklyGoal';
/** app_state: the goal per ISO week, recorded on every change (badge "4 weken op schema"). */
export const WEEKLY_GOAL_HISTORY_KEY = 'tracker.weeklyGoalHistory';
/** app_state: fingerprint of the training data + goals the stored badges were computed from. */
export const BADGE_CACHE_KEY = 'tracker.badges.computedFrom';

export async function loadWeeklyGoalHistory(appState: AppStateRepository): Promise<WeeklyGoalChange[]> {
  return parseGoalHistory(await appState.get<unknown>(WEEKLY_GOAL_HISTORY_KEY));
}

export async function loadWeeklyGoal(appState: AppStateRepository): Promise<number> {
  const raw = await appState.get<unknown>(WEEKLY_GOAL_KEY);
  return raw === null ? DEFAULT_WEEKLY_GOAL : clampWeeklyGoal(raw);
}

/** Saves the goal and records it for the current week onwards (never for past weeks). */
export async function saveWeeklyGoal(appState: AppStateRepository, goal: number, now: Date = new Date()): Promise<number> {
  const g = clampWeeklyGoal(goal);
  const [previous, history] = await Promise.all([loadWeeklyGoal(appState), loadWeeklyGoalHistory(appState)]);
  const monday = startOfWeek(now);
  const from = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
  const next = recordGoalChange(history, previous, { week: weekIndex(now), key: weekKey(now), from, goal: g });
  await appState.set(WEEKLY_GOAL_HISTORY_KEY, next);
  await appState.set(WEEKLY_GOAL_KEY, g);
  return g;
}

/** Finished workouts with completed sets, in the shape the badge logic needs. */
async function badgeInputs(repos: Repositories): Promise<BadgeWorkoutInput[]> {
  const rows = await repos.dataPort.exportRows();
  const byWorkout = new Map<string, BadgeWorkoutInput & { sets: BadgeSetInput[] }>();
  for (const r of rows) {
    let w = byWorkout.get(r.workout_id);
    if (!w) {
      w = { id: r.workout_id, startedAt: r.started_at, endedAt: r.ended_at, sets: [] };
      byWorkout.set(r.workout_id, w);
    }
    w.sets.push({ exerciseId: r.exercise_id, setType: r.set_type, weightKg: r.weight_kg, reps: r.reps });
  }
  return [...byWorkout.values()];
}

export interface BadgeSyncResult {
  /** All stored badges after the sync. */
  stored: UserBadge[];
  /** Badges stored during THIS call (to celebrate once). */
  added: BadgeDefinition[];
}

/**
 * Recomputes badges from local training data and stores the ones not earned
 * before. Earned badges are never removed. Local only: nothing leaves the device.
 *
 * Cheap when nothing changed: the full history is only re-evaluated when the training
 * data (a new, edited, deleted, imported or synced workout or set) or the weekly goal
 * changed since the last evaluation (fingerprint in app_state). `force` skips the check.
 */
export async function syncBadges(repos: Repositories, opts: { force?: boolean } = {}): Promise<BadgeSyncResult> {
  const [fingerprint, goal, history, before, cached] = await Promise.all([
    repos.badges.trainingFingerprint(),
    loadWeeklyGoal(repos.appState),
    loadWeeklyGoalHistory(repos.appState),
    repos.badges.list(),
    repos.appState.get<string>(BADGE_CACHE_KEY),
  ]);
  const computedFrom = JSON.stringify([fingerprint, goal, history]);
  if (!opts.force && cached === computedFrom) return { stored: before, added: [] };

  const workouts = await badgeInputs(repos);
  const fresh = newlyEarned(evaluateBadges(workouts, { weeklyGoal: goal, goalHistory: history }), before.map((b) => b.badge_id));
  const insertedIds = await repos.badges.addMany(
    fresh.map((b) => ({ badge_id: b.badgeId, earned_at: b.earnedAt, source_ref: b.sourceRef })),
  );
  await repos.appState.set(BADGE_CACHE_KEY, computedFrom);
  const stored = insertedIds.length > 0 ? await repos.badges.list() : before;
  const added = insertedIds.filter(isBadgeId).map((id) => BADGE_BY_ID.get(id)).filter((b): b is BadgeDefinition => b !== undefined);
  return { stored, added };
}

/** Catalogue entries (in catalogue order) of stored badges earned by this workout. */
export function badgesFromWorkout(stored: readonly UserBadge[], workoutId: string): BadgeDefinition[] {
  const ids = new Set(stored.filter((b) => b.source_ref === workoutId).map((b) => b.badge_id));
  return BADGES.filter((b) => ids.has(b.id));
}
