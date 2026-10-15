import { createClient } from '@supabase/supabase-js';

import { bearer } from '../_shared/cors.ts';
import { DISCOUNT_BY_CODE_QUERY, DISCOUNT_CREATE_MUTATION, type Redemption, type UserError } from '../_shared/redeem.ts';
import { adminGraphql } from '../_shared/shopifyAdmin.ts';
import { handleRedeem } from './handler.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const SHOP = Deno.env.get('SHOPIFY_SHOP_DOMAIN')!;
const ADMIN_TOKEN = Deno.env.get('SHOPIFY_ADMIN_ACCESS_TOKEN')!;
const CODE_SECRET = Deno.env.get('REDEEM_CODE_SECRET')!;

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throw error;
  return data as T;
}

Deno.serve((req) =>
  handleRedeem(req, bearer(req), {
    async userFromJwt(jwt) {
      const { data, error } = await admin.auth.getUser(jwt);
      return error || !data.user ? null : { id: data.user.id };
    },
    async customerGidFor(userId) {
      const { data, error } = await admin.from('profiles').select('shopify_customer_id').eq('user_id', userId).maybeSingle();
      if (error) throw error;
      return data?.shopify_customer_id ?? null;
    },
    reserve: (u, id, tier) => rpc<Redemption>('redeem_reserve', { p_user_id: u, p_redemption_id: id, p_tier_id: tier }),
    markIssued: (id, code, did, exp) =>
      rpc<Redemption>('redeem_mark_issued', { p_redemption_id: id, p_code: code, p_shopify_discount_id: did, p_expires_at: exp }),
    markFailed: async (id) => {
      await rpc('redeem_mark_failed', { p_redemption_id: id });
    },
    async createDiscount(input) {
      type Data = { discountCodeBasicCreate?: { codeDiscountNode: { id: string } | null; userErrors: UserError[] } };
      const r = await adminGraphql<Data>(fetch, SHOP, ADMIN_TOKEN, DISCOUNT_CREATE_MUTATION, { input });
      const payload = r.data?.discountCodeBasicCreate;
      if (!r.ok || !payload) return { kind: 'unavailable', detail: `HTTP ${r.status}` };
      if (payload.userErrors.length > 0) return { kind: 'user_errors', errors: payload.userErrors };
      if (!payload.codeDiscountNode) return { kind: 'unavailable', detail: 'no node' };
      return { kind: 'created', discountId: payload.codeDiscountNode.id };
    },
    async findDiscountByCode(code) {
      type Data = { codeDiscountNodeByCode: { id: string } | null };
      const r = await adminGraphql<Data>(fetch, SHOP, ADMIN_TOKEN, DISCOUNT_BY_CODE_QUERY, { code });
      return r.data?.codeDiscountNodeByCode?.id ?? null;
    },
    codeSecret: CODE_SECRET,
    now: () => new Date(),
    log: (event, data) => console.log(JSON.stringify({ fn: 'redeem-points', event, ...data })),
  }),
);
