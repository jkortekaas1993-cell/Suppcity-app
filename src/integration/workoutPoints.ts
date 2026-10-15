import type { SyncReport } from '@/lib/db/sync/types';

/**
 * Pure orchestration of "sync first, then ask for workout points" (hard rule 5:
 * the server only awards points for a workout row it already has, and decides
 * eligibility: 18+, max 3 per ISO week, once per workout).
 *
 * Finished workout ids are queued locally; after every successful sync the queue
 * is flushed. A failed sync or a transient RPC error keeps the id for the next run.
 * Only the workout id is sent, never sets or weights (hard rule 1).
 */
export interface PendingStore {
  get(): Promise<string[]>;
  set(ids: string[]): Promise<void>;
}

export type ClaimResult = 'awarded' | 'already_awarded' | 'weekly_cap' | 'not_adult' | 'not_eligible';

export interface WorkoutPointsDeps {
  pending: PendingStore;
  syncNow(): Promise<SyncReport>;
  isSignedIn(): Promise<boolean>;
  claim(workoutId: string): Promise<ClaimResult>;
}

export async function queueWorkoutForPoints(deps: WorkoutPointsDeps, workoutId: string): Promise<void> {
  const ids = await deps.pending.get();
  if (!ids.includes(workoutId)) await deps.pending.set([...ids, workoutId]);
}

/** Sync, then claim points for every queued workout that is now on the server. */
export async function syncThenClaim(deps: WorkoutPointsDeps): Promise<{ report: SyncReport | null; claimed: Record<string, ClaimResult> }> {
  if (!(await deps.isSignedIn())) return { report: null, claimed: {} };
  const report = await deps.syncNow();
  const claimed: Record<string, ClaimResult> = {};
  if (!report.ok) return { report, claimed };
  const queue = await deps.pending.get();
  const keep: string[] = [];
  for (const id of queue) {
    try {
      claimed[id] = await deps.claim(id);
    } catch {
      keep.push(id); // transient: retry after the next sync
    }
  }
  await deps.pending.set(keep);
  return { report, claimed };
}
