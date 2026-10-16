// Public API of the supplements feature (release 2a). Import ONLY from '@/features/supplements'.
// All data is LOCAL ONLY (intakes count as health data, hard rule 1): nothing here syncs.
export { SupplementTodayCard } from './SupplementTodayCard';
export { SupplementsLink } from './SupplementsLink';
export { SupplementsScreen } from './screens/SupplementsScreen';
export { SupplementEditScreen } from './screens/SupplementEditScreen';
export { initSupplementReminders, rescheduleSupplementReminders } from './services/reminders';
export {
  exportSupplementsCsv,
  getSupplementStockForReorder,
  wipeSupplementsLocal,
  type SupplementCsvFile,
} from './services/port';
export type { SupplementReorderSignal } from './logic/stock';
