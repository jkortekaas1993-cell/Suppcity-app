import { finalSyncThenWipe, signOutLocalData, wipeAllLocalData, type SignOutDeps } from '../signOutFlow';

function deps(opts: { session?: boolean; syncOk?: boolean; hang?: boolean } = {}) {
  const calls: string[] = [];
  const d: SignOutDeps = {
    hasBackendSession: async () => opts.session ?? true,
    syncNow: () => {
      calls.push('sync');
      if (opts.hang) return new Promise(() => undefined);
      return Promise.resolve({ ok: opts.syncOk ?? true, startedAt: 't', finishedAt: 't', tables: {} });
    },
    wipeLocalData: async () => void calls.push('wipe'),
    timeoutMs: 5,
  };
  return { d, calls };
}

describe('sign-out: final sync, then wipe local data (H1)', () => {
  it('pushes first, then wipes', async () => {
    const t = deps();
    expect(await finalSyncThenWipe(t.d)).toEqual({ status: 'wiped', synced: true });
    expect(t.calls).toEqual(['sync', 'wipe']);
  });

  it('keeps local data when the final sync fails, unless forced', async () => {
    const failing = deps({ syncOk: false });
    expect(await finalSyncThenWipe(failing.d)).toEqual({ status: 'unsynced' });
    expect(failing.calls).toEqual(['sync']);
    expect(await finalSyncThenWipe(failing.d, { force: true })).toEqual({ status: 'wiped', synced: false });
    expect(failing.calls).toEqual(['sync', 'sync', 'wipe']);
  });

  it('a hanging sync times out instead of blocking sign-out', async () => {
    const t = deps({ hang: true });
    expect(await finalSyncThenWipe(t.d)).toEqual({ status: 'unsynced' });
    expect(t.calls).toEqual(['sync']);
  });

  it('without a backend session nothing can be pushed: ask before wiping', async () => {
    const t = deps({ session: false });
    expect(await finalSyncThenWipe(t.d)).toEqual({ status: 'unsynced' });
    expect(t.calls).toEqual([]);
    expect(await finalSyncThenWipe(t.d, { force: true })).toEqual({ status: 'wiped', synced: false });
  });
});

describe('wipeAllLocalData: tracker and local supplements together', () => {
  it('wipes supplements first, then tracker data', async () => {
    const calls: string[] = [];
    await wipeAllLocalData({
      wipeSupplements: async () => void calls.push('supplements'),
      wipeTracker: async () => void calls.push('tracker'),
    });
    expect(calls).toEqual(['supplements', 'tracker']);
  });

  it('still wipes tracker data when the supplement wipe fails, then reports the error', async () => {
    const calls: string[] = [];
    const err = await wipeAllLocalData({
      wipeSupplements: async () => {
        throw new Error('boom');
      },
      wipeTracker: async () => void calls.push('tracker'),
    }).catch((e: unknown) => e);
    expect((err as Error).message).toBe('boom');
    expect(calls).toEqual(['tracker']);
  });
});

describe('signOutLocalData (ADR-15): supplements stay on the device', () => {
  it('wipes tracker data keeping the supplement settings, then switches supplement reminders', async () => {
    const calls: string[] = [];
    await signOutLocalData({
      wipeTracker: async (opts) => void calls.push(`tracker keep=${opts.keepAppStatePrefixes.join(',')}`),
      keepAppStatePrefixes: ['supplements.'],
      releaseSupplements: async () => void calls.push('supplements→signed out'),
    });
    expect(calls).toEqual(['tracker keep=supplements.', 'supplements→signed out']);
  });

  it('a failing reminder switch does not block the sign-out', async () => {
    await expect(
      signOutLocalData({
        wipeTracker: async () => undefined,
        keepAppStatePrefixes: [],
        releaseSupplements: async () => {
          throw new Error('notifications down');
        },
      }),
    ).resolves.toBeUndefined();
  });
});
