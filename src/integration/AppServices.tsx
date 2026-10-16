import { useEffect, useMemo, type ReactNode } from 'react';

import { registerAccountServices } from '@/features/account';
import { createPointsService } from '@/features/points';
import {
  claimSupplementsForUser,
  initSupplementReminders,
  setSupplementOwnerResolver,
  SUPPLEMENT_SETTING_PREFIX,
  switchSupplementsOwner,
  wipeSupplementsLocal,
} from '@/features/supplements';
import { ActiveWorkoutProvider } from '@/features/tracker';
import { useRepositories, type Repositories } from '@/lib/db';
import { CustomSyncEngine, createSupabaseSyncAdapter, type CursorStore, type RemoteSyncAdapter, type SyncEngine } from '@/lib/db/sync';
import { customerSession } from '@/lib/shopify';
import {
  authNotice,
  createConsentService,
  createPtCodeService,
  currentUserId,
  getSupabase,
  isIntentionalSignOut,
  recoverSupabaseSession,
  RELOGIN_MESSAGE,
  signInWithShopifyToken,
} from '@/lib/supabase';

import { finalSyncThenWipe, signOutLocalData, wipeAllLocalData } from './signOutFlow';
import { queueWorkoutForPoints, syncThenClaim, type WorkoutPointsDeps } from './workoutPoints';

/**
 * App shell wiring between features (owned by the architect, like app/_layout.tsx).
 * Features never import each other's internals; this module connects them:
 *  - account services: ConsentService, PtCodeService (src/lib/supabase) and the
 *    login / account-deletion lifecycle;
 *  - sync: CustomSyncEngine over the tracker's SQLite SyncSource and Supabase;
 *  - points: a finished workout is synced first, then `award_workout_points`;
 *  - supplements (local only, owner-scoped, ADR-15): reminders start after the migrations;
 *    sign-in claims anonymous rows, sign-out KEEPS them (hidden for the next person) and
 *    only account deletion wipes them together with the tracker data.
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
  // Supplement rows are visible for the signed-in user (or signed-out rows only).
  setSupplementOwnerResolver(safeUserId);
  const wipeEverything = () => wipeAllLocalData({ wipeTracker: () => repos.wipeLocalData(), wipeSupplements: () => wipeSupplementsLocal() });
  const wipeForSignOut = () =>
    signOutLocalData({
      wipeTracker: (opts) => repos.wipeLocalData(opts),
      keepAppStatePrefixes: [SUPPLEMENT_SETTING_PREFIX],
      releaseSupplements: () => switchSupplementsOwner(null),
    });
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
        await claimSupplementsForUser(userId).catch(() => undefined);
        await switchSupplementsOwner(userId).catch(() => undefined);
        await syncThenClaim(points);
      },
      async onAccountDeleted() {
        await wipeEverything(); // tracker + supplements; also drops sync cursors and pending point claims
      },
      async onSigningOut({ force }) {
        // Last push while the Supabase session still exists, then wipe the tracker rows
        // (they are in the account). Local-only supplements stay, hidden by owner (ADR-15).
        const res = await finalSyncThenWipe(
          {
            hasBackendSession: async () => (await safeUserId()) !== null,
            syncNow: () => engine.syncNow(),
            wipeLocalData: wipeForSignOut,
          },
          { force },
        );
        return res.status;
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

  // Supplement reminders: <DatabaseProvider> has migrated before this mounts.
  useEffect(() => {
    let cleanup: (() => void) | null = null;
    let active = true;
    // Rows made before owner scoping (or while the claim at sign-in failed) belong to the
    // account that is signed in now; then plan its reminders.
    void safeUserId()
      .then((uid) => (uid ? claimSupplementsForUser(uid) : undefined))
      .catch(() => undefined)
      .then(() => initSupplementReminders())
      .then((c) => {
        if (active) cleanup = c;
        else c();
      });
    return () => {
      active = false;
      cleanup?.();
    };
  }, []);

  // M8: Supabase ended the session by itself (refresh token expired/revoked) while the
  // shop login is still valid → new exchange with a valid Shopify token, else a calm
  // "Log opnieuw in". Never after our own sign-out or account deletion.
  useEffect(() => {
    let sub: { unsubscribe(): void } | null = null;
    try {
      sub = getSupabase().auth.onAuthStateChange((event) => {
        void recoverSupabaseSession(event, {
          shopifyAccessToken: () => customerSession.accessTokenOrNull(),
          exchange: (token) => signInWithShopifyToken(token),
          isSigningOut: isIntentionalSignOut,
        }).then((r) => {
          if (r === 'recovered') void syncThenClaim(services.points).catch(() => undefined);
          if (r === 'login_required') authNotice.set(RELOGIN_MESSAGE);
        });
      }).data.subscription;
    } catch {
      sub = null; // no Supabase env (signed-out-only build)
    }
    return () => sub?.unsubscribe();
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
