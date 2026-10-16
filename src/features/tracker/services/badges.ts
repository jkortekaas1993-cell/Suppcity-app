import type { AppStateRepository, Repositories } from '@/lib/db/repositories';
import type { UserBadge } from '@/lib/db/types';

import {
  BADGE_BY_ID,
  BADGES,
  evaluateBadges,
  isBadgeId,
  newlyEarned,
  type BadgeDefinition,
  type BadgeSetInput,
  type BadgeWorkoutInput,
} from '../logic/badges';
import { clampWeeklyGoal, DEFAULT_WEEKLY_GOAL } from '../logic/week';

/** app_state key of the weekly goal (local only, never synced). */
export const WEEKLY_GOAL_KEY = 'tracker.weeklyGoal';

export async function loadWeeklyGoal(appState: AppStateRepository): Promise<number> {
  const raw = await appState.get<unknown>(WEEKLY_GOAL_KEY);
  return raw === null ? DEFAULT_WEEKLY_GOAL : clampWeeklyGoal(raw);
}

export async function saveWeeklyGoal(appState: AppStateRepository, goal: number): Promise<number> {
  const g = clampWeeklyGoal(goal);
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
 */
export async function syncBadges(repos: Repositories): Promise<BadgeSyncResult> {
  const [workouts, goal, before] = await Promise.all([badgeInputs(repos), loadWeeklyGoal(repos.appState), repos.badges.list()]);
  const fresh = newlyEarned(evaluateBadges(workouts, { weeklyGoal: goal }), before.map((b) => b.badge_id));
  const insertedIds = await repos.badges.addMany(
    fresh.map((b) => ({ badge_id: b.badgeId, earned_at: b.earnedAt, source_ref: b.sourceRef })),
  );
  const stored = insertedIds.length > 0 ? await repos.badges.list() : before;
  const added = insertedIds.filter(isBadgeId).map((id) => BADGE_BY_ID.get(id)).filter((b): b is BadgeDefinition => b !== undefined);
  return { stored, added };
}

/** Catalogue entries (in catalogue order) of stored badges earned by this workout. */
export function badgesFromWorkout(stored: readonly UserBadge[], workoutId: string): BadgeDefinition[] {
  const ids = new Set(stored.filter((b) => b.source_ref === workoutId).map((b) => b.badge_id));
  return BADGES.filter((b) => ids.has(b.id));
}
