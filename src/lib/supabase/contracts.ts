import { z } from 'zod';

/**
 * Edge Function contracts (app side). Server copy: supabase/functions/_shared/contracts.ts.
 * Keep both identical; responses are validated with zod at the boundary.
 */

export const FUNCTIONS = {
  authExchange: 'shopify-auth-exchange',
  deleteAccount: 'delete-account',
  redeemPoints: 'redeem-points',
} as const;

// POST shopify-auth-exchange (no Supabase JWT needed; the Shopify token is the credential)
export interface AuthExchangeRequest {
  /** Customer Account API access token from the PKCE login. Never a customer id. */
  shopifyAccessToken: string;
}
export const AuthExchangeResponse = z.object({
  session: z.object({
    access_token: z.string(),
    refresh_token: z.string(),
    expires_in: z.number(),
    expires_at: z.number(),
    token_type: z.string(),
  }),
  user: z.object({ id: z.string().uuid() }),
  profile: z.object({ adultConfirmed: z.boolean(), isNewUser: z.boolean() }),
});
export type AuthExchangeResponse = z.infer<typeof AuthExchangeResponse>;

// POST delete-account (Authorization: Bearer <supabase access token>, empty body)
export const DeleteAccountResponse = z.object({
  confirmationId: z.string().uuid(),
  deletedAt: z.string(),
});
export type DeleteAccountResponse = z.infer<typeof DeleteAccountResponse>;

// POST redeem-points (Authorization: Bearer <supabase access token>)
export interface RedeemPointsRequest {
  tierId: string;
  /** Client UUID v4. Reuse the SAME id when retrying after an error (idempotency key). */
  redemptionId: string;
}
export const RedeemPointsResponse = z.object({
  redemptionId: z.string().uuid(),
  status: z.literal('issued'),
  code: z.string(),
  valueCents: z.number().int(),
  minOrderCents: z.number().int(),
  points: z.number().int(),
  expiresAt: z.string(),
});
export type RedeemPointsResponse = z.infer<typeof RedeemPointsResponse>;

export const FUNCTION_ERROR_CODES = [
  'method_not_allowed',
  'bad_request',
  'unauthorized',
  'shopify_token_invalid',
  'shopify_unavailable',
  'not_linked',
  'unknown_tier',
  'insufficient_points',
  /** Shopify was unreachable; retry with the same redemptionId. Points stay reserved. */
  'redeem_pending',
  /** Shopify refused definitively; the points were refunded. */
  'redeem_failed',
  'internal',
] as const;
export type FunctionErrorCode = (typeof FUNCTION_ERROR_CODES)[number];

export const FunctionErrorBody = z.object({
  error: z.enum(FUNCTION_ERROR_CODES),
  message: z.string().optional(),
});

/** Thrown by the client services for any non-2xx Edge Function response. */
export class FunctionCallError extends Error {
  constructor(
    readonly code: FunctionErrorCode | 'network',
    readonly status: number,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'FunctionCallError';
  }
}

// RPC return values
export const WORKOUT_POINTS_RESULTS = ['awarded', 'already_awarded', 'weekly_cap', 'not_adult', 'not_eligible'] as const;
export type WorkoutPointsResult = (typeof WORKOUT_POINTS_RESULTS)[number];
