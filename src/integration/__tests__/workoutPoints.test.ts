import type { SyncReport } from '@/lib/db/sync/types';

import { queueWorkoutForPoints, syncThenClaim, type ClaimResult, type WorkoutPointsDeps } from '../workoutPoints';

function deps(opts: { signedIn?: boolean; syncOk?: boolean; claim?: (id: string) => Promise<ClaimResult> } = {}) {
  let queue: string[] = [];
  const calls: string[] = [];
  const d: WorkoutPointsDeps = {
    pending: { get: async () => [...queue], set: async (ids) => void (queue = [...ids]) },
    isSignedIn: async () => opts.signedIn ?? true,
    syncNow: async (): Promise<SyncReport> => {
      calls.push('sync');
      return { ok: opts.syncOk ?? true, startedAt: 't', finishedAt: 't', tables: {} };
    },
    claim: async (id) => {
      calls.push(`claim:${id}`);
      return opts.claim ? opts.claim(id) : 'awarded';
    },
  };
  return { d, calls, queue: () => queue };
}

describe('workout points after sync', () => {
  it('syncs BEFORE claiming and empties the queue', async () => {
    const t = deps();
    await queueWorkoutForPoints(t.d, 'w1');
    await queueWorkoutForPoints(t.d, 'w1');
    const r = await syncThenClaim(t.d);
    expect(t.calls).toEqual(['sync', 'claim:w1']);
    expect(r.claimed).toEqual({ w1: 'awarded' });
    expect(t.queue()).toEqual([]);
  });

  it('keeps the workout queued when sync fails or the RPC errors', async () => {
    const failing = deps({ syncOk: false });
    await queueWorkoutForPoints(failing.d, 'w1');
    await syncThenClaim(failing.d);
    expect(failing.calls).toEqual(['sync']);
    expect(failing.queue()).toEqual(['w1']);

    const flaky = deps({ claim: async (id) => (id === 'w2' ? Promise.reject(new Error('net')) : 'weekly_cap') });
    await queueWorkoutForPoints(flaky.d, 'w1');
    await queueWorkoutForPoints(flaky.d, 'w2');
    const r = await syncThenClaim(flaky.d);
    expect(r.claimed).toEqual({ w1: 'weekly_cap' });
    expect(flaky.queue()).toEqual(['w2']);
  });

  it('does nothing when signed out', async () => {
    const t = deps({ signedIn: false });
    await queueWorkoutForPoints(t.d, 'w1');
    expect((await syncThenClaim(t.d)).report).toBeNull();
    expect(t.calls).toEqual([]);
    expect(t.queue()).toEqual(['w1']);
  });
});
