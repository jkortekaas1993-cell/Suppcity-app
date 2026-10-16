import { useCallback } from 'react';

import { loadWeekSummary } from './data/loaders';
import type { ReadDb } from './data/queries';
import { useProgressQuery, type ProgressQuery } from './data/useProgressQuery';
import type { WeekSummary } from './logic/week';

/**
 * This ISO week vs. last week (workouts, working sets, duration, volume) plus sets per
 * muscle group. Reloads on focus. For the Vandaag tile "Volume week":
 *   const { data } = useWeekSummary(); formatVolume(data.current.volumeKg)
 * Local only: never send this to marketing, points or segmentation (hard rule 1).
 */
export function useWeekSummary(): ProgressQuery<WeekSummary> {
  const load = useCallback((db: ReadDb, uid: string | null) => loadWeekSummary(db, uid), []);
  return useProgressQuery(load);
}
