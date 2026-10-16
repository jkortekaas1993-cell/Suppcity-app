import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useDatabase, type SqlDb } from '@/lib/db';

/** What the Ik header shows from local tracker data: "Lid sinds oktober 2026 · 47 workouts". */
export interface TrainingProfile {
  /** ISO timestamp of the first local workout, or null without workouts. */
  memberSince: string | null;
  /** Finished, not deleted workouts. */
  workoutCount: number;
}

type ReadDb = Pick<SqlDb, 'getFirstAsync'>;

export const TRAINING_PROFILE_SQL = `SELECT COUNT(*) AS n, MIN(started_at) AS first FROM workouts WHERE deleted_at IS NULL AND ended_at IS NOT NULL`;

/** Read-only, local. Never sent anywhere (hard rule 1: training data is not used for marketing). */
export async function loadTrainingProfile(db: ReadDb): Promise<TrainingProfile> {
  const row = await db.getFirstAsync<{ n: number | null; first: string | null }>(TRAINING_PROFILE_SQL, []);
  return { memberSince: row?.first ?? null, workoutCount: Number(row?.n ?? 0) };
}

/** Reloads when the Ik tab gains focus; null until loaded or when the query fails. */
export function useTrainingProfile(): TrainingProfile | null {
  const db = useDatabase();
  const [profile, setProfile] = useState<TrainingProfile | null>(null);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadTrainingProfile({ getFirstAsync: (sql, params) => db.getFirstAsync(sql, params) })
        .then((p) => active && setProfile(p))
        .catch(() => active && setProfile(null));
      return () => {
        active = false;
      };
    }, [db]),
  );
  return profile;
}
