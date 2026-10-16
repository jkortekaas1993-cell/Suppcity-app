import type { SyncReport } from '@/lib/db/sync/types';

/**
 * Pure orchestration of the local side of signing out (review H1).
 *
 * Tracker rows are stamped with the account's user_id. If they stayed on the device
 * after sign-out, the next account on the same phone would see them, and its sync would
 * keep pushing rows that RLS rejects. So on sign-out we:
 *   1. try one last push/pull (bounded by a timeout) so nothing unsynced is lost;
 *   2. wipe local tracker data, app_state and sync cursors (same as account deletion).
 * If the final sync fails, nothing is wiped unless the user explicitly chose to
 * sign out anyway (`force`), because the wipe would lose their unsynced workouts.
 */
export interface SignOutDeps {
  /** True when a Supabase session exists (the account rows can be pushed). */
  hasBackendSession(): Promise<boolean>;
  syncNow(): Promise<SyncReport>;
  wipeLocalData(): Promise<void>;
  timeoutMs?: number;
}

export type LocalSignOutResult = { status: 'wiped'; synced: boolean } | { status: 'unsynced' };

const DEFAULT_TIMEOUT_MS = 15_000;

export async function finalSyncThenWipe(deps: SignOutDeps, opts: { force?: boolean } = {}): Promise<LocalSignOutResult> {
  let synced = false;
  if (await deps.hasBackendSession().catch(() => false)) {
    const report = await withTimeout(deps.syncNow(), deps.timeoutMs ?? DEFAULT_TIMEOUT_MS).catch(() => null);
    synced = report?.ok === true;
  }
  if (!synced && !opts.force) return { status: 'unsynced' };
  await deps.wipeLocalData();
  return { status: 'wiped', synced };
}

/**
 * Everything on this device that belongs to the signed-in person: the local-only supplement
 * schedule incl. its reminders, then tracker data and app_state (cursors, pending claims).
 * Sequential (two SQLite connections must not write at once); the tracker wipe still runs
 * when the supplement wipe fails, and the first error is rethrown.
 */
export async function wipeAllLocalData(deps: { wipeTracker(): Promise<void>; wipeSupplements(): Promise<void> }): Promise<void> {
  let error: unknown = null;
  try {
    await deps.wipeSupplements();
  } catch (e) {
    error = e;
  }
  await deps.wipeTracker();
  if (error) throw error;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}
