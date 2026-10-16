/**
 * CSV export of the user's own supplement data (hard rule 9). Pure.
 * Two files: the supplements with their schedules, and the intake log.
 * RFC 4180 quoting; formula-looking cells are prefixed with ' (CSV injection).
 */

export type CsvCell = string | number | null | undefined;

function cell(v: CsvCell): string {
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s) && typeof v === 'string') s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: readonly string[], rows: readonly (readonly CsvCell[])[]): string {
  return [headers, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

export const SUPPLEMENT_HEADERS = [
  'supplement_id',
  'name',
  'dose_text',
  'units_per_pack',
  'units_left',
  'shopify_variant_gid',
  'schedule_id',
  'mode',
  'days',
  'time_local',
  'created_at',
] as const;

export const INTAKE_HEADERS = ['intake_id', 'supplement_id', 'supplement_name', 'scheduled_for', 'status', 'taken_at', 'updated_at'] as const;

export interface SupplementExportRow {
  supplement_id: string;
  name: string;
  dose_text: string;
  units_per_pack: number | null;
  units_left: number | null;
  shopify_variant_gid: string | null;
  schedule_id: string | null;
  mode: string | null;
  /** e.g. "ma, wo, vr" */
  days: string | null;
  time_local: string | null;
  created_at: string;
}

export interface IntakeExportRow {
  intake_id: string;
  supplement_id: string;
  supplement_name: string;
  scheduled_for: string;
  status: string;
  taken_at: string | null;
  updated_at: string;
}

export function supplementsToCsv(rows: readonly SupplementExportRow[]): string {
  return toCsv(
    SUPPLEMENT_HEADERS,
    rows.map((r) => SUPPLEMENT_HEADERS.map((h) => r[h])),
  );
}

export function intakesToCsv(rows: readonly IntakeExportRow[]): string {
  return toCsv(
    INTAKE_HEADERS,
    rows.map((r) => INTAKE_HEADERS.map((h) => r[h])),
  );
}

export const SUPPLEMENTS_CSV_FILE = 'suppcity-supplementen.csv';
export const INTAKES_CSV_FILE = 'suppcity-supplement-innames.csv';
