import { useCallback, useState } from 'react';

import { useRepositories } from '@/lib/db';

import { useFocusQuery } from '../components/useFocusQuery';
import { badgeViews, type BadgeDefinition, type BadgeView } from '../logic/badges';
import { loadWeeklyGoal, saveWeeklyGoal, syncBadges } from '../services/badges';

export interface UseBadgesResult {
  /** Full catalogue in display order, with earned state. */
  badges: BadgeView[];
  earnedCount: number;
  total: number;
  /** Badges stored during the last refresh (celebrate once). */
  justEarned: BadgeDefinition[];
  loading: boolean;
  reload: () => void;
}

/**
 * Milestones for the current device, refreshed when the screen gains focus.
 * Recomputes from local training data and stores new badges (local only).
 */
export function useBadges(): UseBadgesResult {
  const repos = useRepositories();
  const load = useCallback(() => syncBadges(repos), [repos]);
  const { data, loading, reload } = useFocusQuery(load);
  const badges = badgeViews(data?.stored ?? []);
  return {
    badges,
    earnedCount: badges.filter((b) => b.earned).length,
    total: badges.length,
    justEarned: data?.added ?? [],
    loading,
    reload,
  };
}

/** The weekly goal (1–5 workouts per week), stored locally in app_state. */
export function useWeeklyGoal(): { goal: number | undefined; setGoal: (goal: number) => Promise<void> } {
  const repos = useRepositories();
  const load = useCallback(() => loadWeeklyGoal(repos.appState), [repos]);
  const { data } = useFocusQuery(load);
  const [override, setOverride] = useState<number | undefined>(undefined);
  const setGoal = useCallback(
    async (goal: number) => {
      setOverride(await saveWeeklyGoal(repos.appState, goal));
    },
    [repos],
  );
  return { goal: override ?? data, setGoal };
}
