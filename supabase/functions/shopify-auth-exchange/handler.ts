// shopify-auth-exchange: Shopify Customer Account access token → Supabase session.
//
// Method (see supabase/README.md, "Auth linking"):
//  1. Verify the token SERVER-SIDE by calling the Customer Account API with it; the
//     customer gid comes from Shopify's answer, never from the request.
//  2. Find or create the auth user (service role). Users get a synthetic,
//     non-deliverable e-mail derived from the customer gid (no real e-mail stored).
//  3. Link profiles.shopify_customer_id (service-only RPC).
//  4. Mint a normal Supabase session: admin.generateLink(magiclink) returns a hashed
//     token WITHOUT sending mail; verifyOtp(token_hash) exchanges it for a session.
//     Standard GoTrue sessions: refresh tokens, revocation and auth.uid() all work,
//     and no JWT secret ever leaves Supabase. Password/OTP sign-in for these users is
//     impossible in practice (random password never stored, e-mail undeliverable).
import { errorResponse, json, preflight } from '../_shared/cors.ts';
import { AuthExchangeRequest, type AuthExchangeResponse } from '../_shared/contracts.ts';
import type { VerifyResult } from '../_shared/shopifyCustomer.ts';

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  token_type: string;
  user: { id: string };
}

export interface AuthExchangeDeps {
  verifyToken(token: string): Promise<VerifyResult>;
  syntheticEmail(customerGid: string): string;
  findUser(customerGid: string): Promise<string | null>;
  createUser(email: string, customerGid: string): Promise<{ id: string } | { alreadyExists: true }>;
  linkCustomer(userId: string, customerGid: string): Promise<void>;
  isAdultConfirmed(userId: string): Promise<boolean>;
  mintSession(email: string): Promise<Session>;
  log(event: string, data?: Record<string, unknown>): void;
}

export async function handleAuthExchange(req: Request, deps: AuthExchangeDeps): Promise<Response> {
  const early = preflight(req);
  if (early) return early;

  const parsed = AuthExchangeRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorResponse(400, 'bad_request');

  const verified = await deps.verifyToken(parsed.data.shopifyAccessToken);
  if (!verified.ok) {
    deps.log('verify_failed', { reason: verified.reason });
    return verified.reason === 'invalid_token'
      ? errorResponse(401, 'shopify_token_invalid')
      : errorResponse(502, 'shopify_unavailable');
  }
  const customerGid = verified.customerGid;
  const email = deps.syntheticEmail(customerGid);

  try {
    let userId = await deps.findUser(customerGid);
    let isNewUser = false;
    if (!userId) {
      const created = await deps.createUser(email, customerGid);
      if ('id' in created) {
        userId = created.id;
        isNewUser = true;
      } else {
        userId = await deps.findUser(customerGid); // concurrent first login
      }
    }
    if (!userId) return errorResponse(500, 'internal', 'user not found after create');
    await deps.linkCustomer(userId, customerGid);

    const session = await deps.mintSession(email);
    if (session.user.id !== userId) return errorResponse(500, 'internal', 'session user mismatch');

    const body: AuthExchangeResponse = {
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_in: session.expires_in,
        expires_at: session.expires_at ?? Math.floor(Date.now() / 1000) + session.expires_in,
        token_type: session.token_type,
      },
      user: { id: userId },
      profile: { adultConfirmed: await deps.isAdultConfirmed(userId), isNewUser },
    };
    deps.log('exchanged', { isNewUser });
    return json(body);
  } catch (e) {
    deps.log('exchange_error', { message: String(e) });
    return errorResponse(500, 'internal');
  }
}
