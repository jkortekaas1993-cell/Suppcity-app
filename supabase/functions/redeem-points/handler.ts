// redeem-points: points → one-time Shopify discount code.
//
// Two-phase, idempotent on the client's redemptionId:
//  1. redeem_reserve (one DB transaction, per-user advisory lock): balance check +
//     ledger debit + 'pending' redemption. A replay returns the existing row.
//  2. Shopify discountCodeBasicCreate with a code DERIVED from the redemption id.
//     Success or "code taken" (earlier attempt succeeded) → lookup → mark 'issued'.
//     Definitive userErrors → mark 'failed' (refunds points once).
//     Network/5xx → stays 'pending'; the client retries with the same id.
import { errorResponse, json, preflight } from '../_shared/cors.ts';
import { RedeemPointsRequest, type RedeemPointsResponse } from '../_shared/contracts.ts';
import { buildDiscountInput, deriveDiscountCode, isCodeTaken, type Redemption, type UserError } from '../_shared/redeem.ts';

export type ShopifyCreateResult =
  | { kind: 'created'; discountId: string }
  | { kind: 'user_errors'; errors: UserError[] }
  | { kind: 'unavailable'; detail: string };

export interface RedeemDeps {
  userFromJwt(jwt: string): Promise<{ id: string } | null>;
  customerGidFor(userId: string): Promise<string | null>;
  reserve(userId: string, redemptionId: string, tierId: string): Promise<Redemption>;
  markIssued(redemptionId: string, code: string, discountId: string | null, expiresAt: string): Promise<Redemption>;
  markFailed(redemptionId: string): Promise<void>;
  createDiscount(input: ReturnType<typeof buildDiscountInput>): Promise<ShopifyCreateResult>;
  findDiscountByCode(code: string): Promise<string | null>;
  codeSecret: string;
  now(): Date;
  log(event: string, data?: Record<string, unknown>): void;
}

function ok(r: Redemption): Response {
  const body: RedeemPointsResponse = {
    redemptionId: r.id,
    status: 'issued',
    code: r.discount_code ?? '',
    valueCents: r.value_cents,
    minOrderCents: r.min_order_cents,
    points: r.points,
    expiresAt: r.expires_at ?? '',
  };
  return json(body);
}

export async function handleRedeem(req: Request, jwt: string | null, deps: RedeemDeps): Promise<Response> {
  const early = preflight(req);
  if (early) return early;
  if (!jwt) return errorResponse(401, 'unauthorized');
  const user = await deps.userFromJwt(jwt);
  if (!user) return errorResponse(401, 'unauthorized');
  const parsed = RedeemPointsRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorResponse(400, 'bad_request');
  const customerGid = await deps.customerGidFor(user.id);
  if (!customerGid) return errorResponse(409, 'not_linked');

  let r: Redemption;
  try {
    r = await deps.reserve(user.id, parsed.data.redemptionId, parsed.data.tierId);
  } catch (e) {
    const msg = String((e as { message?: string })?.message ?? e);
    if (msg.includes('insufficient_points')) return errorResponse(409, 'insufficient_points');
    if (msg.includes('unknown_tier')) return errorResponse(400, 'unknown_tier');
    if (msg.includes('another user')) return errorResponse(400, 'bad_request');
    deps.log('reserve_error', { message: msg });
    return errorResponse(500, 'internal');
  }
  if (r.status === 'issued') return ok(r);
  if (r.status === 'failed') return errorResponse(502, 'redeem_failed');

  const code = await deriveDiscountCode(r.id, deps.codeSecret);
  const input = buildDiscountInput(r, code, customerGid, deps.now());
  const res = await deps.createDiscount(input);

  let discountId: string | null = null;
  if (res.kind === 'created') {
    discountId = res.discountId;
  } else if (res.kind === 'user_errors' && isCodeTaken(res.errors)) {
    discountId = await deps.findDiscountByCode(code); // earlier attempt already created it
    if (!discountId) return errorResponse(503, 'redeem_pending');
  } else if (res.kind === 'user_errors') {
    deps.log('shopify_user_errors', { errors: res.errors.map((e) => e.code ?? e.message) });
    await deps.markFailed(r.id);
    return errorResponse(502, 'redeem_failed');
  } else {
    deps.log('shopify_unavailable', { detail: res.detail });
    return errorResponse(503, 'redeem_pending');
  }
  const issued = await deps.markIssued(r.id, code, discountId, input.endsAt);
  return ok(issued);
}
