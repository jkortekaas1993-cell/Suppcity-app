import type { SqlDb } from '@/lib/db';

import { INTAKES_CSV_FILE, intakesToCsv, SUPPLEMENTS_CSV_FILE, supplementsToCsv } from '../logic/csv';
import { LOW_STOCK_DAYS, reorderSignals, type SupplementReorderSignal } from '../logic/stock';
import { cancelAllSupplementReminders } from './reminders';
import { notifySupplementsChanged, sharedRepository } from './store';

export interface SupplementCsvFile {
  fileName: string;
  csv: string;
}

/**
 * Hard rule 9: the user's own supplement data as CSV (supplements + schedule, and the
 * intake log). The integrator hangs these next to the training CSV in the Data screen.
 */
export async function exportSupplementsCsv(db?: SqlDb): Promise<SupplementCsvFile[]> {
  const repo = await sharedRepository(db);
  const { supplements, intakes } = await repo.exportRows();
  return [
    { fileName: SUPPLEMENTS_CSV_FILE, csv: supplementsToCsv(supplements) },
    { fileName: INTAKES_CSV_FILE, csv: intakesToCsv(intakes) },
  ];
}

/** Logout / account deletion (hard rule 3): removes all local supplement data and reminders. */
export async function wipeSupplementsLocal(db?: SqlDb): Promise<void> {
  await cancelAllSupplementReminders();
  const repo = await sharedRepository(db);
  await repo.wipe();
  notifySupplementsChanged();
}

/**
 * Adapter for the shop's ReorderCard: linked supplements that are almost out.
 * Hard rule 1: returns ONLY variant gid, the user's own name for it and days left.
 * No intake log, no times, no schedule. Never send this to Shopify/marketing.
 */
export async function getSupplementStockForReorder(
  opts: { db?: SqlDb; thresholdDays?: number } = {},
): Promise<SupplementReorderSignal[]> {
  try {
    const repo = await sharedRepository(opts.db);
    return reorderSignals(await repo.list(), opts.thresholdDays ?? LOW_STOCK_DAYS);
  } catch {
    return [];
  }
}
