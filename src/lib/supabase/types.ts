/**
 * Server-side table shapes. Replace with generated types
 * (`supabase gen types typescript`) once the project exists.
 */

export type ConsentType = 'marketing_email' | 'marketing_push' | 'health_sync' | 'analytics' | 'pt_share';

export interface ConsentEvent {
  id: string;
  user_id: string;
  consent_type: ConsentType;
  granted: boolean;
  policy_version: string;
  source: 'app' | 'web';
  created_at: string;
}

export type PointsReason = 'order' | 'workout' | 'redeem' | 'adjustment' | 'expiry';

export interface PointsLedgerEntry {
  id: string;
  user_id: string;
  reason: PointsReason;
  points: number;
  reference: string | null;
  iso_week: string | null;
  created_at: string;
}
