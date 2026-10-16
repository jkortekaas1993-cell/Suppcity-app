import type { ScheduleMode } from '../logic/schedule';

/** Row shapes of the local-only supplement tables (src/lib/db/migrations/0004_supplements.ts). */
interface LocalRow {
  id: string;
  user_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Supplement extends LocalRow {
  name: string;
  shopify_variant_gid: string | null;
  /** Free text the user typed ("5 g", "2 caps"). The app never suggests one. */
  dose_text: string;
  units_per_pack: number | null;
  units_left: number | null;
}

export interface SupplementSchedule extends LocalRow {
  supplement_id: string;
  days_mask: number;
  mode: ScheduleMode;
  time_local: string;
}

export type IntakeStatus = 'taken' | 'skipped';

export interface SupplementIntake extends LocalRow {
  supplement_id: string;
  schedule_id: string | null;
  /** Local 'YYYY-MM-DDTHH:MM'. */
  scheduled_for: string;
  status: IntakeStatus;
  /** ISO-8601 UTC, set when status = 'taken'. */
  taken_at: string | null;
}

export interface SupplementWithSchedules extends Supplement {
  schedules: SupplementSchedule[];
}

export interface ScheduleInput {
  mode: ScheduleMode;
  days_mask: number;
  time_local: string;
}

export interface SupplementInput {
  id?: string;
  name: string;
  shopify_variant_gid: string | null;
  dose_text: string;
  units_per_pack: number | null;
  units_left: number | null;
  schedules: ScheduleInput[];
}
