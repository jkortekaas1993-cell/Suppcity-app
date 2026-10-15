// Request/response contracts of the Edge Functions (server copy).
// The app-side copy is src/lib/supabase/contracts.ts; a type test keeps both identical.
import { z } from 'zod';

export const AuthExchangeRequest = z.object({
  shopifyAccessToken: z.string().min(20).max(4096),
});
export type AuthExchangeRequest = z.infer<typeof AuthExchangeRequest>;

export interface AuthExchangeResponse {
  session: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    expires_at: number;
    token_type: string;
  };
  user: { id: string };
  profile: { adultConfirmed: boolean; isNewUser: boolean };
}

export interface DeleteAccountResponse {
  /** Anonymous confirmation id, also stored in public.account_deletions. */
  confirmationId: string;
  deletedAt: string;
}

export const RedeemPointsRequest = z.object({
  tierId: z.string().min(1).max(64),
  /** Client-generated UUID v4; retry with the same id after a network error. */
  redemptionId: z.string().uuid(),
});
export type RedeemPointsRequest = z.infer<typeof RedeemPointsRequest>;

export interface RedeemPointsResponse {
  redemptionId: string;
  status: 'issued';
  code: string;
  valueCents: number;
  minOrderCents: number;
  points: number;
  expiresAt: string;
}

export type FunctionErrorCode =
  | 'method_not_allowed'
  | 'bad_request'
  | 'unauthorized'
  | 'shopify_token_invalid'
  | 'shopify_unavailable'
  | 'not_linked'
  | 'unknown_tier'
  | 'insufficient_points'
  | 'redeem_pending'
  | 'redeem_failed'
  | 'internal';

export interface FunctionError {
  error: FunctionErrorCode;
  message?: string;
}
