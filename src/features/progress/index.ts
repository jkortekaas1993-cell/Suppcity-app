// Public API of the progress feature (Voortgang, release 2a). Import ONLY from '@/features/progress'.
// Read-only on the tracker's local SQLite data; nothing is sent off the device (hard rule 1).
export { ProgressScreen } from './screens/ProgressScreen';
export { ProgressEntryCard } from './ProgressEntryCard';
export { useWeekSummary } from './useWeekSummary';
export type { ProgressQuery } from './data/useProgressQuery';
export type { MuscleSetCount, WeekStats, WeekSummary } from './logic/week';
export { formatDuration, formatNumberNl, formatVolume } from './logic/format';
