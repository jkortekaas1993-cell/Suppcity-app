import { migrate } from '@/lib/db/migrate';
import { supplementsMigration, SUPPLEMENT_TABLES } from '@/lib/db/migrations/0004_supplements';
import { migrations, TRACKER_TABLES } from '@/lib/db/schema';
import { nodeSqliteAvailable, openNodeSqlite } from '@/lib/db/testing/nodeSqliteDb';

import { maskFromDays } from '../../logic/schedule';
import { createSupplementRepository } from '../supplementRepository';

const maybe = nodeSqliteAvailable ? describe : describe.skip;

async function setup() {
  const db = openNodeSqlite();
  const version = await migrate(db, migrations);
  let n = 0;
  let t = Date.parse('2026-10-16T08:00:00.000Z');
  let who: string | null = null;
  const deps = { newId: () => `id-${++n}`, now: () => new Date(t).toISOString(), owner: () => Promise.resolve(who) };
  const repo = createSupplementRepository(db, deps);
  return { db, repo, version, tick: (ms = 1000) => void (t += ms), signIn: (uid: string | null) => void (who = uid) };
}

const creatine = {
  name: 'Creatine',
  dose_text: '5 g',
  shopify_variant_gid: null,
  units_per_pack: 100,
  units_left: 100,
  schedules: [{ mode: 'fixed' as const, days_mask: 0b1111111, time_local: '08:00' }],
};

describe('migration 4', () => {
  it('is version 4, local only and not a tracker (synced) table', () => {
    expect(supplementsMigration.version).toBe(4);
    for (const t of SUPPLEMENT_TABLES) {
      expect(supplementsMigration.sql).toContain(`CREATE TABLE IF NOT EXISTS ${t}`);
      expect((TRACKER_TABLES as readonly string[]).includes(t)).toBe(false);
    }
    expect(migrations.find((m) => m.version === 4)).toBe(supplementsMigration); // registered right after migration 3
  });
});

maybe('supplement repository (node:sqlite)', () => {
  it('creates, lists and edits a supplement with its schedule', async () => {
    const { repo, version, tick } = await setup();
    expect(version).toBe(4);
    const s = await repo.save({
      name: 'Creatine',
      dose_text: '5 g',
      shopify_variant_gid: 'gid://shopify/ProductVariant/1',
      units_per_pack: 100,
      units_left: 100,
      schedules: [{ mode: 'training', days_mask: maskFromDays([0, 2, 4]), time_local: '17:30' }],
    });
    expect(s).toMatchObject({ id: 'id-1', name: 'Creatine', units_left: 100 });
    expect(s.schedules).toHaveLength(1);
    expect(s.schedules[0]).toMatchObject({ mode: 'training', days_mask: 0b10101, time_local: '17:30' });

    tick();
    const edited = await repo.save({ ...s, id: s.id, dose_text: '3 g', schedules: [{ mode: 'fixed', days_mask: 0b1111111, time_local: '08:00' }] });
    expect(edited.dose_text).toBe('3 g');
    expect(edited.schedules.map((x) => x.time_local)).toEqual(['08:00']);
    expect(await repo.list()).toHaveLength(1);

    await repo.softDelete(s.id);
    expect(await repo.list()).toEqual([]);
    expect(await repo.get(s.id)).toBeNull();
  });

  it('marks intakes, subtracts stock once and restores it on undo', async () => {
    const { repo } = await setup();
    const s = await repo.save({
      name: 'Omega 3',
      dose_text: '2 caps',
      shopify_variant_gid: null,
      units_per_pack: 90,
      units_left: 10,
      schedules: [{ mode: 'fixed', days_mask: 0b1111111, time_local: '08:00' }],
    });
    const scheduleId = s.schedules[0]!.id;
    const slot = { supplementId: s.id, scheduleId, scheduledFor: '2026-10-16T08:00' };

    await repo.setIntake({ ...slot, status: 'taken' });
    await repo.setIntake({ ...slot, status: 'taken' }); // idempotent (notification + tap)
    expect((await repo.get(s.id))?.units_left).toBe(9);
    const today = await repo.intakesBetween('2026-10-16T00:00', '2026-10-17T00:00');
    expect(today).toHaveLength(1);
    expect(today[0]).toMatchObject({ status: 'taken', taken_at: '2026-10-16T08:00:00.000Z' });

    await repo.setIntake({ ...slot, status: 'skipped' });
    expect((await repo.get(s.id))?.units_left).toBe(10);

    await repo.setIntake({ ...slot, status: 'taken' });
    await repo.clearIntake(s.id, slot.scheduledFor);
    expect((await repo.get(s.id))?.units_left).toBe(10);
    expect(await repo.intakesBetween('2026-10-16T00:00', '2026-10-17T00:00')).toEqual([]);

    // Re-marking after undo reuses the slot (unique supplement + moment).
    await repo.setIntake({ ...slot, status: 'taken' });
    expect(await repo.intakesBetween('2026-10-16T00:00', '2026-10-17T00:00')).toHaveLength(1);
  });

  it('re-derives training and rest days for all such schedules', async () => {
    const { repo } = await setup();
    const a = await repo.save({ name: 'A', dose_text: '', shopify_variant_gid: null, units_per_pack: null, units_left: null, schedules: [{ mode: 'training', days_mask: 0b1, time_local: '17:00' }] });
    const b = await repo.save({ name: 'B', dose_text: '', shopify_variant_gid: null, units_per_pack: null, units_left: null, schedules: [{ mode: 'rest', days_mask: 0b1111110, time_local: '22:00' }] });
    const c = await repo.save({ name: 'C', dose_text: '', shopify_variant_gid: null, units_per_pack: null, units_left: null, schedules: [{ mode: 'fixed', days_mask: 0b1, time_local: '07:00' }] });
    await repo.applyTrainingDays(maskFromDays([1, 3]));
    expect((await repo.get(a.id))?.schedules[0]?.days_mask).toBe(0b1010);
    expect((await repo.get(b.id))?.schedules[0]?.days_mask).toBe(0b1110101);
    expect((await repo.get(c.id))?.schedules[0]?.days_mask).toBe(0b1);
  });

  it('exports CSV rows and wipes everything incl. its settings', async () => {
    const { repo, db } = await setup();
    const s = await repo.save({ name: 'ZMA', dose_text: '1 caps', shopify_variant_gid: null, units_per_pack: 60, units_left: 60, schedules: [{ mode: 'fixed', days_mask: 0b1111111, time_local: '22:00' }] });
    await repo.setIntake({ supplementId: s.id, scheduleId: s.schedules[0]!.id, scheduledFor: '2026-10-15T22:00', status: 'taken' });
    await repo.setSetting('supplements.reminders', { enabled: true, decidedAt: 'x' });
    await db.runAsync("INSERT INTO app_state (key, value) VALUES ('notifications.prefs', '{}')", []);

    const rows = await repo.exportRows();
    expect(rows.supplements).toHaveLength(1);
    expect(rows.supplements[0]).toMatchObject({ name: 'ZMA', days: 'elke dag', time_local: '22:00', mode: 'fixed' });
    expect(rows.intakes).toHaveLength(1);
    expect(rows.intakes[0]).toMatchObject({ supplement_name: 'ZMA', scheduled_for: '2026-10-15T22:00', status: 'taken' });

    await repo.wipe();
    expect(await repo.list()).toEqual([]);
    expect(await repo.getSetting('supplements.reminders')).toBeNull();
    // Other features' app_state is untouched.
    expect(await db.getFirstAsync("SELECT key FROM app_state WHERE key = 'notifications.prefs'", [])).toEqual({ key: 'notifications.prefs' });
    for (const t of SUPPLEMENT_TABLES) expect(await db.getFirstAsync(`SELECT COUNT(*) AS n FROM ${t}`, [])).toEqual({ n: 0 });
  });

  it('owner scoping (ADR-15): sign-out keeps rows but hides them; claim at sign-in; per-owner settings', async () => {
    const { repo, db, signIn } = await setup();
    // Signed out: an anonymous supplement.
    const anon = await repo.save({ ...creatine, name: 'Anon' });
    expect(anon.user_id).toBeNull();
    await repo.setSetting('supplements.trainingDays', 0b101);

    // Sign-in as A claims it, settings move with it.
    await repo.claimAnonymous('A');
    signIn('A');
    const a = await repo.save({ ...creatine, name: 'Van A' });
    expect(a.user_id).toBe('A');
    expect(a.schedules[0]?.user_id).toBe('A');
    await repo.setIntake({ supplementId: a.id, scheduleId: a.schedules[0]!.id, scheduledFor: '2026-10-16T08:00', status: 'taken' });
    expect((await repo.list()).map((x) => x.name)).toEqual(['Anon', 'Van A']);
    expect(await repo.getSetting('supplements.trainingDays')).toBe(0b101);
    await repo.setSetting('supplements.notificationNames', true);

    // Sign-out: nothing deleted, nothing visible for the next person.
    signIn(null);
    expect(await repo.list()).toEqual([]);
    expect(await repo.get(a.id)).toBeNull();
    expect(await repo.intakesBetween('2026-10-16T00:00', '2026-10-17T00:00')).toEqual([]);
    expect(await repo.getSetting('supplements.trainingDays')).toBeNull();
    expect(await repo.getSetting('supplements.notificationNames')).toBeNull();
    expect((await repo.exportRows()).intakes).toEqual([]);
    expect(await db.getFirstAsync('SELECT COUNT(*) AS n FROM supplements', [])).toEqual({ n: 2 });

    // Another account B on the same phone: still invisible, cannot touch A's rows.
    signIn('B');
    expect(await repo.list()).toEqual([]);
    await repo.softDelete(a.id);
    await repo.setIntake({ supplementId: a.id, scheduleId: null, scheduledFor: '2026-10-17T08:00', status: 'taken' });
    await expect(repo.save({ ...creatine, id: a.id, name: 'Kaping' })).rejects.toThrow();
    await repo.applyTrainingDays(0b1);

    // A signs in again: everything is back, unchanged.
    signIn('A');
    const back = await repo.list();
    expect(back.map((x) => x.name)).toEqual(['Anon', 'Van A']);
    expect(back.find((x) => x.id === a.id)?.units_left).toBe(99);
    expect(await repo.intakesBetween('2026-10-16T00:00', '2026-10-18T00:00')).toHaveLength(1);
    expect(await repo.getSetting('supplements.notificationNames')).toBe(true);

    // Account deletion wipes every owner's supplement rows and settings.
    await repo.wipe();
    for (const t of SUPPLEMENT_TABLES) expect(await db.getFirstAsync(`SELECT COUNT(*) AS n FROM ${t}`, [])).toEqual({ n: 0 });
    expect(await db.getFirstAsync("SELECT COUNT(*) AS n FROM app_state WHERE key LIKE 'supplements.%'", [])).toEqual({ n: 0 });
  });

  it('claim keeps an account setting that already exists', async () => {
    const { repo, signIn } = await setup();
    signIn('A');
    await repo.setSetting('supplements.trainingDays', 0b1);
    signIn(null);
    await repo.setSetting('supplements.trainingDays', 0b11);
    await repo.claimAnonymous('A');
    signIn('A');
    expect(await repo.getSetting('supplements.trainingDays')).toBe(0b1);
    signIn(null);
    expect(await repo.getSetting('supplements.trainingDays')).toBeNull();
  });
});
