import { useEffect, useMemo, type ReactNode } from 'react';

import { registerAccountServices } from '@/features/account';
import { createPointsService } from '@/features/points';
import { ActiveWorkoutProvider } from '@/features/tracker';
import { useRepositories, type Repositories } from '@/lib/db';
import { CustomSyncEngine, createSupabaseSyncAdapter, type CursorStore, type RemoteSyncAdapter, type SyncEngine } from '@/lib/db/sync';
import { createConsentService, createPtCodeService, currentUserId, getSupabase } from '@/lib/supabase';

import { queueWorkoutForPoints, syncThenClaim, type WorkoutPointsDeps } from './workoutPoints';

/**
 * App shell wiring between features (owned by the architect, like app/_layout.tsx).
 * Features never import each other's internals; this module connects them:
 *  - account services: ConsentService, PtCodeService (src/lib/supabase) and the
 *    login / account-deletion lifecycle;
 *  - sync: CustomSyncEngine over the tracker's SQLite SyncSource and Supabase;
 *  - points: a finished workout is synced first, then `award_workout_points`.
 */

const PENDING_POINTS_KEY = 'points.pendingWorkouts';

/** Sync cursors live in the local-only app_state table (wiped with the account). */
function appStateCursors(repos: Repositories): CursorStore {
  return {
    get: async (key) => (await repos.appState.get<string>(key)) ?? null,
    set: (key, value) => repos.appState.set(key, value),
  };
}

/** Supabase is created lazily so a build without Supabase env still runs (signed-out only). */
function lazyRemote(): RemoteSyncAdapter {
  let remote: RemoteSyncAdapter | null = null;
  const get = () => (remote ??= createSupabaseSyncAdapter(getSupabase()));
  return { push: (t, rows) => get().push(t, rows), pull: (t, after, limit) => get().pull(t, after, limit) };
}

async function safeUserId(): Promise<string | null> {
  try {
    return await currentUserId();
  } catch {
    return null;
  }
}

export function createAppServices(repos: Repositories): { engine: SyncEngine; points: WorkoutPointsDeps } {
  const engine = new CustomSyncEngine({
    local: repos.sync,
    remote: lazyRemote(),
    cursors: appStateCursors(repos),
    getUserId: safeUserId,
  });
  const points: WorkoutPointsDeps = {
    pending: {
      get: async () => (await repos.appState.get<string[]>(PENDING_POINTS_KEY)) ?? [],
      set: (ids) => (ids.length ? repos.appState.set(PENDING_POINTS_KEY, ids) : repos.appState.remove(PENDING_POINTS_KEY)),
    },
    syncNow: () => engine.syncNow(),
    isSignedIn: async () => (await safeUserId()) !== null,
    claim: (workoutId) => createPointsService(getSupabase()).claimWorkoutPoints(workoutId),
  };

  registerAccountServices({
    consents: {
      list: () => createConsentService().list(),
      grant: (type, v) => createConsentService().grant(type, v),
      revoke: (type, v) => createConsentService().revoke(type, v),
    },
    ptCode: {
      current: () => createPtCodeService().current(),
      link: (code) => createPtCodeService().link(code),
      unlink: () => createPtCodeService().unlink(),
    },
    lifecycle: {
      async onSignedIn({ userId }) {
        // Attach rows made while signed out to this account, then push/pull and
        // claim points for workouts finished before login (server decides eligibility).
        await repos.sync.claimAnonymousRows(userId);
        await syncThenClaim(points);
      },
      async onAccountDeleted() {
        await repos.wipeLocalData(); // also drops sync cursors and pending point claims
      },
    },
  });

  return { engine, points };
}

/** Wraps the tracker provider and runs a sync on start when a session exists. */
export function AppServices({ children }: { children: ReactNode }) {
  const repos = useRepositories();
  const services = useMemo(() => createAppServices(repos), [repos]);

  useEffect(() => {
    void syncThenClaim(services.points).catch(() => undefined);
  }, [services]);

  const onWorkoutFinished = useMemo(
    () => async (workoutId: string) => {
      await queueWorkoutForPoints(services.points, workoutId);
      await syncThenClaim(services.points);
    },
    [services],
  );

  return <ActiveWorkoutProvider onWorkoutFinished={onWorkoutFinished}>{children}</ActiveWorkoutProvider>;
}
