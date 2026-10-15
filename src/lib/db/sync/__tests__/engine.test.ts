import { CustomSyncEngine } from '../engine';
import { fromRemote, toRemote } from '../mapping';
import { mergeRow } from '../merge';
import { backoffDelay, isRetryableError, withRetry } from '../retry';
import { keysetFilter } from '../supabaseAdapter';
import type { LocalSyncStore, PullCursor, RemoteRow, RemoteSyncAdapter, SyncRow, SyncTable } from '../types';

/** In-memory "server" that mimics sync_row_write + keyset pull. */
function fakeServer(failPushes = 0) {
  const tables = new Map<SyncTable, Map<string, RemoteRow>>();
  let clock = Date.parse('2026-10-15T00:00:00Z');
  let pushCalls = 0;
  const tbl = (t: SyncTable) => tables.get(t) ?? tables.set(t, new Map()).get(t)!;
  const adapter: RemoteSyncAdapter = {
    async push(t, rows) {
      pushCalls++;
      if (failPushes > 0) {
        failPushes--;
        throw Object.assign(new Error('network'), { status: 503 });
      }
      for (const r of rows) {
        const old = tbl(t).get(r.id);
        const merged = mergeRow(old ?? null, r as RemoteRow); // same rules as the trigger
        if (merged) tbl(t).set(r.id, { ...merged, server_updated_at: new Date(++clock).toISOString() } as RemoteRow);
      }
    },
    async pull(t, after: PullCursor | null, limit) {
      const all = [...tbl(t).values()]
        .filter((r) => !after || r.server_updated_at > after.serverUpdatedAt || (r.server_updated_at === after.serverUpdatedAt && r.id > after.id))
        .sort((a, b) => (a.server_updated_at === b.server_updated_at ? a.id.localeCompare(b.id) : a.server_updated_at.localeCompare(b.server_updated_at)));
      const rows = all.slice(0, limit);
      const last = rows[rows.length - 1];
      return { rows, next: last ? { serverUpdatedAt: last.server_updated_at, id: last.id } : null, hasMore: all.length > limit };
    },
  };
  return { adapter, tbl, pushCalls: () => pushCalls };
}

/** In-memory device DB in LOCAL format. */
function fakeDevice() {
  const tables = new Map<SyncTable, Map<string, Record<string, unknown>>>();
  const tbl = (t: SyncTable) => tables.get(t) ?? tables.set(t, new Map()).get(t)!;
  const store: LocalSyncStore = {
    async changesSince(t, after) {
      return [...tbl(t).values()].filter((r) => !after || Date.parse(String(r.updated_at)) > Date.parse(after));
    },
    async getByIds(t, ids) {
      return ids.map((id) => tbl(t).get(id)).filter((r): r is Record<string, unknown> => !!r);
    },
    async applyRemote(t, rows) {
      for (const r of rows) tbl(t).set(String(r.id), { ...r });
    },
    async claimAnonymousRows(userId) {
      for (const m of tables.values()) for (const r of m.values()) if (r.user_id == null) r.user_id = userId;
    },
  };
  return { store, tbl };
}

function memCursors() {
  const m = new Map<string, string>();
  return { get: async (k: string) => m.get(k) ?? null, set: async (k: string, v: string) => void m.set(k, v) };
}

const workout = (id: string, title: string, updated: string, extra: Record<string, unknown> = {}) => ({
  id,
  user_id: null,
  routine_id: null,
  title,
  started_at: '2026-10-14T10:00:00.000Z',
  ended_at: null,
  notes: null,
  source: 'app',
  created_at: '2026-10-14T10:00:00.000Z',
  updated_at: updated,
  deleted_at: null,
  ...extra,
});

const noSleep = { sleep: async () => {}, random: () => 0 };

describe('CustomSyncEngine', () => {
  it('two devices converge (LWW), deletes propagate, replays are idempotent', async () => {
    const server = fakeServer();
    const a = fakeDevice();
    const b = fakeDevice();
    const mk = (d: ReturnType<typeof fakeDevice>) =>
      new CustomSyncEngine({ local: d.store, remote: server.adapter, cursors: memCursors(), getUserId: async () => 'u1', batchSize: 2, retry: noSleep });
    const ea = mk(a);
    const eb = mk(b);

    for (let i = 0; i < 5; i++) a.tbl('workouts').set(`w${i}`, workout(`w${i}`, `A${i}`, `2026-10-14T10:0${i}:00.000Z`));
    const r1 = await ea.syncNow();
    expect(r1.ok).toBe(true);
    expect(r1.tables.workouts?.pushed).toBe(5);
    expect(a.tbl('workouts').get('w0')?.user_id).toBe('u1'); // claimed

    await eb.syncNow();
    expect(b.tbl('workouts').size).toBe(5);

    // concurrent edits: B newer on w1, A newer on w2, B deletes w3 (older than A's edit)
    b.tbl('workouts').set('w1', workout('w1', 'B-new', '2026-10-15T12:00:00.000Z', { user_id: 'u1' }));
    a.tbl('workouts').set('w1', workout('w1', 'A-old', '2026-10-15T11:00:00.000Z', { user_id: 'u1' }));
    a.tbl('workouts').set('w2', workout('w2', 'A-new', '2026-10-15T12:00:00.000Z', { user_id: 'u1' }));
    b.tbl('workouts').set('w2', workout('w2', 'B-old', '2026-10-15T11:00:00.000Z', { user_id: 'u1' }));
    b.tbl('workouts').set('w3', workout('w3', 'A3', '2026-10-15T10:00:00.000Z', { user_id: 'u1', deleted_at: '2026-10-15T10:00:00.000Z' }));
    a.tbl('workouts').set('w3', workout('w3', 'A-edit', '2026-10-15T11:00:00.000Z', { user_id: 'u1' }));

    await ea.syncNow();
    await eb.syncNow();
    await ea.syncNow();

    for (const d of [a, b]) {
      expect(d.tbl('workouts').get('w1')?.title).toBe('B-new');
      expect(d.tbl('workouts').get('w2')?.title).toBe('A-new');
      expect(d.tbl('workouts').get('w3')?.deleted_at).toBe('2026-10-15T10:00:00.000Z');
    }
    expect(server.tbl('workouts').get('w3')?.deleted_at).toBe('2026-10-15T10:00:00.000Z');

    // a further sync with no changes applies nothing
    const idle = await eb.syncNow();
    expect(idle.tables.workouts?.applied).toBe(0);
  });

  it('retries transient push errors with backoff, then succeeds', async () => {
    const server = fakeServer(2);
    const d = fakeDevice();
    d.tbl('workouts').set('w1', workout('w1', 't', '2026-10-14T10:00:00.000Z'));
    const sleeps: number[] = [];
    const e = new CustomSyncEngine({
      local: d.store, remote: server.adapter, cursors: memCursors(), getUserId: async () => 'u1',
      retry: { sleep: async (ms) => void sleeps.push(ms), random: () => 0.5, baseMs: 100, maxMs: 1000 },
    });
    const r = await e.syncNow();
    expect(r.ok).toBe(true);
    expect(sleeps).toEqual([50, 100]);
    expect(server.tbl('workouts').size).toBe(1);
  });

  it('reports failure without throwing and does not advance the push cursor', async () => {
    const server = fakeServer(99);
    const d = fakeDevice();
    d.tbl('workouts').set('w1', workout('w1', 't', '2026-10-14T10:00:00.000Z'));
    const cursors = memCursors();
    const e = new CustomSyncEngine({ local: d.store, remote: server.adapter, cursors, getUserId: async () => 'u1', retry: { ...noSleep, retries: 1 } });
    const r = await e.syncNow();
    expect(r.ok).toBe(false);
    expect(await cursors.get('sync:u1:push:workouts')).toBeNull();
  });

  it('is a no-op when signed out and shares concurrent runs', async () => {
    const server = fakeServer();
    const d = fakeDevice();
    d.tbl('workouts').set('w1', workout('w1', 't', '2026-10-14T10:00:00.000Z'));
    const out = new CustomSyncEngine({ local: d.store, remote: server.adapter, cursors: memCursors(), getUserId: async () => null });
    await out.syncNow();
    expect(server.pushCalls()).toBe(0);
    const e = new CustomSyncEngine({ local: d.store, remote: server.adapter, cursors: memCursors(), getUserId: async () => 'u1', retry: noSleep });
    const [r1, r2] = [e.syncNow(), e.syncNow()];
    expect(r1).toBe(r2);
    await r1;
  });

  it('never pushes built-in exercises; maps custom exercise columns', async () => {
    const server = fakeServer();
    const d = fakeDevice();
    const base = { user_id: null, slug: null, primary_muscle: 'borst', equipment: 'barbell', created_at: '2026-10-14T00:00:00.000Z', updated_at: '2026-10-14T00:00:00.000Z', deleted_at: null };
    d.tbl('exercises').set('bench-press', { ...base, id: 'bench-press', slug: 'bench-press', name_nl: 'Bankdrukken', secondary_muscles: '[]', is_custom: 0 });
    d.tbl('exercises').set('c1', { ...base, id: 'c1', name_nl: 'Mijn oefening', secondary_muscles: '["triceps"]', is_custom: 1 });
    const e = new CustomSyncEngine({ local: d.store, remote: server.adapter, cursors: memCursors(), getUserId: async () => 'u1', retry: noSleep });
    await e.syncNow();
    expect([...server.tbl('exercises').keys()]).toEqual(['c1']);
    expect(server.tbl('exercises').get('c1')).toMatchObject({ is_custom: true, secondary_muscles: ['triceps'], user_id: 'u1' });
  });
});

describe('mapping, retry, keyset', () => {
  it('round-trips exercises and coerces numerics', () => {
    const local = { id: 'c1', user_id: null, slug: null, name_nl: 'x', primary_muscle: 'borst', secondary_muscles: '["rug"]', equipment: 'cable', is_custom: 1, created_at: 'a', updated_at: 'b', deleted_at: null, extra: 'dropped' };
    const remote = toRemote('exercises', local, 'u1');
    expect(remote).not.toHaveProperty('extra');
    expect(fromRemote('exercises', remote)).toMatchObject({ is_custom: 1, secondary_muscles: '["rug"]' });
    expect(fromRemote('sets', { id: 's', user_id: 'u', created_at: 'a', updated_at: 'b', deleted_at: null, weight_kg: '100.50', rpe: '8.5' } as SyncRow)).toMatchObject({ weight_kg: 100.5, rpe: 8.5 });
  });
  it('retry classification and delay', async () => {
    expect(isRetryableError({ code: '42501' })).toBe(false);
    expect(isRetryableError({ code: '23505' })).toBe(false);
    expect(isRetryableError({ status: 400 })).toBe(false);
    expect(isRetryableError({ status: 429 })).toBe(true);
    expect(isRetryableError(new TypeError('Network request failed'))).toBe(true);
    expect(backoffDelay(10, 500, 15_000, () => 0.999)).toBeLessThan(15_000);
    let n = 0;
    await expect(withRetry(async () => { n++; throw { code: '42501' }; }, { retries: 5, baseMs: 1, maxMs: 1, sleep: async () => {} })).rejects.toEqual({ code: '42501' });
    expect(n).toBe(1);
  });
  it('keyset filter', () => {
    expect(keysetFilter({ serverUpdatedAt: '2026-10-15T10:00:00.123456+00:00', id: 'abc' })).toBe(
      'server_updated_at.gt."2026-10-15T10:00:00.123456+00:00",and(server_updated_at.eq."2026-10-15T10:00:00.123456+00:00",id.gt.abc)',
    );
    expect(keysetFilter({ serverUpdatedAt: 't', id: '' })).toBe('server_updated_at.gt."t"');
  });
});
