import type { SqlDb, SqlValue } from '@/lib/db';

import { applyIntakeDelta } from '../logic/stock';
import { effectiveMask, scheduleLabel, type ScheduleMode } from '../logic/schedule';
import type { IntakeExportRow, SupplementExportRow } from '../logic/csv';
import type {
  IntakeStatus,
  Supplement,
  SupplementInput,
  SupplementIntake,
  SupplementSchedule,
  SupplementWithSchedules,
} from './types';

/**
 * Local-only repository for the supplement schedule (release 2a).
 *
 * Health data (hard rule 1): nothing here is synced or sent anywhere. The tables are
 * not in TRACKER_TABLES, so the sync engine never sees them. Rows keep the usual
 * client UUID + timestamps + soft delete so they can sync later if that is ever decided.
 */

export interface SupplementRepoDeps {
  newId: () => string;
  now: () => string;
}

export interface SupplementRepository {
  list(): Promise<SupplementWithSchedules[]>;
  get(id: string): Promise<SupplementWithSchedules | null>;
  /** Creates or updates a supplement and replaces its schedules, in one transaction. */
  save(input: SupplementInput): Promise<SupplementWithSchedules>;
  softDelete(id: string): Promise<void>;
  /** Re-derives days_mask of all training/rest schedules from the user's training days. */
  applyTrainingDays(trainingDaysMask: number): Promise<void>;
  /** Live intakes with from <= scheduled_for < to (local 'YYYY-MM-DDTHH:MM' keys). */
  intakesBetween(from: string, to: string): Promise<SupplementIntake[]>;
  /** Marks one planned moment taken/skipped and adjusts units_left (one unit per intake). */
  setIntake(input: { supplementId: string; scheduleId: string | null; scheduledFor: string; status: IntakeStatus }): Promise<void>;
  /** Undo: removes the mark and gives the unit back when it was taken. */
  clearIntake(supplementId: string, scheduledFor: string): Promise<void>;
  exportRows(): Promise<{ supplements: SupplementExportRow[]; intakes: IntakeExportRow[] }>;
  getSetting<T>(key: SupplementSettingKey): Promise<T | null>;
  setSetting(key: SupplementSettingKey, value: unknown): Promise<void>;
  /** Hard-deletes all supplement rows and settings (logout / account deletion). */
  wipe(): Promise<void>;
}

/** Our keys in the local-only app_state table. */
export type SupplementSettingKey = 'supplements.reminders' | 'supplements.trainingDays' | 'supplements.lastPlan';
const SETTING_PREFIX = 'supplements.';

type SupplementRow = Supplement;
interface ScheduleRow extends Omit<SupplementSchedule, 'mode'> {
  mode: string;
}

const MODES: readonly ScheduleMode[] = ['fixed', 'training', 'rest'];
const asMode = (m: string): ScheduleMode => (MODES.includes(m as ScheduleMode) ? (m as ScheduleMode) : 'fixed');
const toSchedule = (r: ScheduleRow): SupplementSchedule => ({ ...r, mode: asMode(r.mode) });

export function createSupplementRepository(db: SqlDb, deps: SupplementRepoDeps): SupplementRepository {
  async function schedulesFor(ids: string[]): Promise<Map<string, SupplementSchedule[]>> {
    const out = new Map<string, SupplementSchedule[]>();
    if (ids.length === 0) return out;
    const rows = await db.getAllAsync<ScheduleRow>(
      `SELECT * FROM supplement_schedules WHERE deleted_at IS NULL AND supplement_id IN (${ids.map(() => '?').join(',')})
       ORDER BY time_local, created_at`,
      ids,
    );
    for (const r of rows) {
      const list = out.get(r.supplement_id) ?? [];
      list.push(toSchedule(r));
      out.set(r.supplement_id, list);
    }
    return out;
  }

  async function list(): Promise<SupplementWithSchedules[]> {
    const rows = await db.getAllAsync<SupplementRow>(
      'SELECT * FROM supplements WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE, created_at',
      [],
    );
    const sch = await schedulesFor(rows.map((r) => r.id));
    return rows.map((r) => ({ ...r, schedules: sch.get(r.id) ?? [] }));
  }

  async function get(id: string): Promise<SupplementWithSchedules | null> {
    const row = await db.getFirstAsync<SupplementRow>('SELECT * FROM supplements WHERE id = ? AND deleted_at IS NULL', [id]);
    if (!row) return null;
    const sch = await schedulesFor([id]);
    return { ...row, schedules: sch.get(id) ?? [] };
  }

  async function save(input: SupplementInput): Promise<SupplementWithSchedules> {
    const now = deps.now();
    const id = input.id ?? deps.newId();
    await db.withTransactionAsync(async () => {
      const existing = input.id
        ? await db.getFirstAsync<{ id: string }>('SELECT id FROM supplements WHERE id = ?', [input.id])
        : null;
      const values: SqlValue[] = [
        input.name.trim(),
        input.shopify_variant_gid,
        input.dose_text.trim(),
        input.units_per_pack,
        input.units_left,
        now,
      ];
      if (existing) {
        await db.runAsync(
          `UPDATE supplements SET name = ?, shopify_variant_gid = ?, dose_text = ?, units_per_pack = ?, units_left = ?,
             updated_at = ?, deleted_at = NULL WHERE id = ?`,
          [...values, id],
        );
        await db.runAsync(
          'UPDATE supplement_schedules SET deleted_at = ?, updated_at = ? WHERE supplement_id = ? AND deleted_at IS NULL',
          [now, now, id],
        );
      } else {
        await db.runAsync(
          `INSERT INTO supplements (id, name, shopify_variant_gid, dose_text, units_per_pack, units_left, updated_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, ...values, now],
        );
      }
      for (const s of input.schedules) {
        await db.runAsync(
          `INSERT INTO supplement_schedules (id, supplement_id, days_mask, mode, time_local, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [deps.newId(), id, s.days_mask, s.mode, s.time_local, now, now],
        );
      }
    });
    const saved = await get(id);
    if (!saved) throw new Error('Supplement not saved');
    return saved;
  }

  async function softDelete(id: string): Promise<void> {
    const now = deps.now();
    await db.withTransactionAsync(async () => {
      await db.runAsync('UPDATE supplements SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL', [now, now, id]);
      await db.runAsync(
        'UPDATE supplement_schedules SET deleted_at = ?, updated_at = ? WHERE supplement_id = ? AND deleted_at IS NULL',
        [now, now, id],
      );
    });
  }

  async function applyTrainingDays(trainingDaysMask: number): Promise<void> {
    const now = deps.now();
    await db.withTransactionAsync(async () => {
      for (const mode of ['training', 'rest'] as const) {
        await db.runAsync(
          `UPDATE supplement_schedules SET days_mask = ?, updated_at = ?
           WHERE deleted_at IS NULL AND mode = ? AND days_mask <> ?`,
          [effectiveMask(mode, 0, trainingDaysMask), now, mode, effectiveMask(mode, 0, trainingDaysMask)],
        );
      }
    });
  }

  async function intakesBetween(from: string, to: string): Promise<SupplementIntake[]> {
    return db.getAllAsync<SupplementIntake>(
      `SELECT * FROM supplement_intakes WHERE deleted_at IS NULL AND scheduled_for >= ? AND scheduled_for < ?
       ORDER BY scheduled_for`,
      [from, to],
    );
  }

  async function adjustUnits(supplementId: string, wasTaken: boolean, isTaken: boolean, now: string) {
    const s = await db.getFirstAsync<{ units_left: number | null }>('SELECT units_left FROM supplements WHERE id = ?', [supplementId]);
    if (!s) return;
    const next = applyIntakeDelta(s.units_left, wasTaken, isTaken);
    if (next !== s.units_left) {
      await db.runAsync('UPDATE supplements SET units_left = ?, updated_at = ? WHERE id = ?', [next, now, supplementId]);
    }
  }

  async function currentStatus(supplementId: string, scheduledFor: string): Promise<IntakeStatus | null> {
    const row = await db.getFirstAsync<{ status: IntakeStatus }>(
      'SELECT status FROM supplement_intakes WHERE supplement_id = ? AND scheduled_for = ? AND deleted_at IS NULL',
      [supplementId, scheduledFor],
    );
    return row?.status ?? null;
  }

  async function setIntake(input: { supplementId: string; scheduleId: string | null; scheduledFor: string; status: IntakeStatus }) {
    const now = deps.now();
    await db.withTransactionAsync(async () => {
      const before = await currentStatus(input.supplementId, input.scheduledFor);
      await db.runAsync(
        `INSERT INTO supplement_intakes (id, supplement_id, schedule_id, scheduled_for, status, taken_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(supplement_id, scheduled_for) DO UPDATE SET
           schedule_id = excluded.schedule_id, status = excluded.status, taken_at = excluded.taken_at,
           updated_at = excluded.updated_at, deleted_at = NULL`,
        [
          deps.newId(),
          input.supplementId,
          input.scheduleId,
          input.scheduledFor,
          input.status,
          input.status === 'taken' ? now : null,
          now,
          now,
        ],
      );
      await adjustUnits(input.supplementId, before === 'taken', input.status === 'taken', now);
    });
  }

  async function clearIntake(supplementId: string, scheduledFor: string) {
    const now = deps.now();
    await db.withTransactionAsync(async () => {
      const before = await currentStatus(supplementId, scheduledFor);
      if (before === null) return;
      await db.runAsync(
        `UPDATE supplement_intakes SET deleted_at = ?, updated_at = ?
         WHERE supplement_id = ? AND scheduled_for = ? AND deleted_at IS NULL`,
        [now, now, supplementId, scheduledFor],
      );
      await adjustUnits(supplementId, before === 'taken', false, now);
    });
  }

  async function exportRows() {
    const items = await list();
    const supplements: SupplementExportRow[] = items.flatMap((s): SupplementExportRow[] => {
      const base = {
        supplement_id: s.id,
        name: s.name,
        dose_text: s.dose_text,
        units_per_pack: s.units_per_pack,
        units_left: s.units_left,
        shopify_variant_gid: s.shopify_variant_gid,
        created_at: s.created_at,
      };
      if (s.schedules.length === 0) return [{ ...base, schedule_id: null, mode: null, days: null, time_local: null }];
      return s.schedules.map((sc) => ({ ...base, schedule_id: sc.id, mode: sc.mode, days: scheduleLabel(sc), time_local: sc.time_local }));
    });
    const intakes = await db.getAllAsync<IntakeExportRow>(
      `SELECT i.id AS intake_id, i.supplement_id, s.name AS supplement_name, i.scheduled_for, i.status, i.taken_at, i.updated_at
       FROM supplement_intakes i JOIN supplements s ON s.id = i.supplement_id
       WHERE i.deleted_at IS NULL ORDER BY i.scheduled_for, s.name`,
      [],
    );
    return { supplements, intakes };
  }

  async function getSetting<T>(key: SupplementSettingKey): Promise<T | null> {
    const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM app_state WHERE key = ?', [key]);
    if (!row) return null;
    try {
      return JSON.parse(row.value) as T;
    } catch {
      return null;
    }
  }

  async function setSetting(key: SupplementSettingKey, value: unknown): Promise<void> {
    await db.runAsync(
      `INSERT INTO app_state (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [key, JSON.stringify(value), deps.now()],
    );
  }

  async function wipe(): Promise<void> {
    await db.withTransactionAsync(async () => {
      for (const t of ['supplement_intakes', 'supplement_schedules', 'supplements'] as const) {
        await db.runAsync(`DELETE FROM ${t}`, []);
      }
      await db.runAsync('DELETE FROM app_state WHERE key LIKE ?', [`${SETTING_PREFIX}%`]);
    });
  }

  return {
    list,
    get,
    save,
    softDelete,
    applyTrainingDays,
    intakesBetween,
    setIntake,
    clearIntake,
    exportRows,
    getSetting,
    setSetting,
    wipe,
  };
}
