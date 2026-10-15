import { handleDeleteAccount } from '../delete-account/handler.ts';
import { computeShopifyHmac } from '../_shared/hmac.ts';
import type { Redemption } from '../_shared/redeem.ts';
import { handleRedeem, type RedeemDeps, type ShopifyCreateResult } from '../redeem-points/handler.ts';
import { handleAuthExchange, type AuthExchangeDeps } from '../shopify-auth-exchange/handler.ts';
import { handleWebhook, type WebhookDeps } from '../shopify-webhooks/handler.ts';
import { assert, assertEquals } from './assert.ts';

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('https://fn.test/x', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });

// ---------------- auth exchange ----------------
function authDeps(over: Partial<AuthExchangeDeps> = {}): AuthExchangeDeps & { calls: string[] } {
  const calls: string[] = [];
  const users = new Map<string, string>();
  return {
    calls,
    verifyToken: async (t) => (t.startsWith('good') ? { ok: true, customerGid: 'gid://shopify/Customer/42' } : { ok: false, reason: 'invalid_token' }),
    syntheticEmail: (g) => `shopify-${g.split('/').pop()}@auth.suppcity.nl`,
    findUser: async (g) => users.get(g) ?? null,
    createUser: async (_e, g) => { calls.push('create'); users.set(g, 'u-1'); return { id: 'u-1' }; },
    linkCustomer: async (u, g) => { calls.push(`link:${u}:${g}`); },
    isAdultConfirmed: async () => false,
    mintSession: async () => ({ access_token: 'at', refresh_token: 'rt', expires_in: 3600, expires_at: 1, token_type: 'bearer', user: { id: 'u-1' } }),
    log: () => {},
    ...over,
  };
}

Deno.test('auth exchange: creates, links and returns session; second login reuses user', async () => {
  const d = authDeps();
  const r1 = await handleAuthExchange(post({ shopifyAccessToken: 'good-token-xxxxxxxxxxxxxxxx' }), d);
  assertEquals(r1.status, 200);
  const b1 = await r1.json();
  assertEquals(b1.user.id, 'u-1');
  assertEquals(b1.profile.isNewUser, true);
  assertEquals(b1.session.refresh_token, 'rt');
  const r2 = await handleAuthExchange(post({ shopifyAccessToken: 'good-token-xxxxxxxxxxxxxxxx' }), d);
  assertEquals((await r2.json()).profile.isNewUser, false);
  assertEquals(d.calls.filter((c) => c === 'create').length, 1);
  assert(d.calls.includes('link:u-1:gid://shopify/Customer/42'), 'linked with Shopify-verified gid');
});

Deno.test('auth exchange: rejects invalid token, ignores client-supplied customer id', async () => {
  const d = authDeps();
  const r = await handleAuthExchange(post({ shopifyAccessToken: 'bad-token-xxxxxxxxxxxxxxxxx', shopifyCustomerId: 'gid://shopify/Customer/1' }), d);
  assertEquals(r.status, 401);
  assertEquals((await r.json()).error, 'shopify_token_invalid');
  assertEquals(d.calls.length, 0);
  assertEquals((await handleAuthExchange(post({}), d)).status, 400);
  assertEquals((await handleAuthExchange(new Request('https://x', { method: 'GET' }), d)).status, 405);
  const down = authDeps({ verifyToken: async () => ({ ok: false, reason: 'unavailable' }) });
  assertEquals((await handleAuthExchange(post({ shopifyAccessToken: 'good-token-xxxxxxxxxxxxxxxx' }), down)).status, 502);
});

Deno.test('auth exchange: concurrent first login falls back to lookup; session mismatch refused', async () => {
  let n = 0;
  const d = authDeps({ findUser: async () => (n++ === 0 ? null : 'u-1'), createUser: async () => ({ alreadyExists: true }) });
  assertEquals((await handleAuthExchange(post({ shopifyAccessToken: 'good-token-xxxxxxxxxxxxxxxx' }), d)).status, 200);
  const mm = authDeps({ mintSession: async () => ({ access_token: 'a', refresh_token: 'r', expires_in: 1, token_type: 'bearer', user: { id: 'other' } }) });
  assertEquals((await handleAuthExchange(post({ shopifyAccessToken: 'good-token-xxxxxxxxxxxxxxxx' }), mm)).status, 500);
});

// ---------------- delete account ----------------
Deno.test('delete account: requires JWT, deletes caller only', async () => {
  const deleted: string[] = [];
  const deps = {
    userFromJwt: async (j: string) => (j === 'valid' ? { id: 'u-1' } : null),
    deleteAccount: async (u: string) => { deleted.push(u); return 'conf-1'; },
    log: () => {},
  };
  assertEquals((await handleDeleteAccount(post({ userId: 'u-2' }), null, deps)).status, 401);
  assertEquals((await handleDeleteAccount(post({}), 'forged', deps)).status, 401);
  const r = await handleDeleteAccount(post({ userId: 'u-2' }), 'valid', deps);
  assertEquals(r.status, 200);
  assertEquals((await r.json()).confirmationId, 'conf-1');
  assertEquals(deleted, ['u-1']);
});

// ---------------- webhooks ----------------
function hookDeps(over: Partial<WebhookDeps> = {}): WebhookDeps & { log2: string[] } {
  const log2: string[] = [];
  return {
    log2,
    secrets: ['whsec'],
    shopDomain: 'suppcity.myshopify.com',
    awardOrderPoints: async (c, o, p) => { log2.push(`award:${c}:${o}:${p}`); return 'awarded'; },
    recordPrivacyRequest: async (r) => { log2.push(`privacy:${r.topic}:${r.status}`); return true; },
    hasCustomerData: async () => true,
    findUserByCustomer: async (c) => (c.endsWith('/1001') ? 'u-1' : null),
    deleteAccount: async (u) => { log2.push(`delete:${u}`); },
    redactShop: async () => { log2.push('redact_shop'); },
    log: () => {},
    ...over,
  };
}
async function signed(topic: string, body: unknown, secret = 'whsec', shop = 'suppcity.myshopify.com') {
  const raw = JSON.stringify(body);
  const hmac = await computeShopifyHmac(secret, new TextEncoder().encode(raw));
  return post(raw, { 'X-Shopify-Topic': topic, 'X-Shopify-Hmac-Sha256': hmac, 'X-Shopify-Shop-Domain': shop, 'X-Shopify-Webhook-Id': 'wh-1' });
}

Deno.test('webhooks: invalid HMAC → 401 for every topic (incl. compliance)', async () => {
  const d = hookDeps();
  for (const t of ['orders/paid', 'customers/data_request', 'customers/redact', 'shop/redact']) {
    assertEquals((await handleWebhook(await signed(t, { shop_domain: 'x' }, 'wrong'), d)).status, 401, t);
  }
  assertEquals(d.log2.length, 0);
});

Deno.test('webhooks: orders/paid awards floor(subtotal) to Shopify customer', async () => {
  const d = hookDeps();
  const r = await handleWebhook(await signed('orders/paid', {
    id: 5001, currency: 'EUR', customer: { id: 1001 },
    current_subtotal_price_set: { shop_money: { amount: '57.99', currency_code: 'EUR' } },
  }), d);
  assertEquals(r.status, 200);
  assertEquals(d.log2, ['award:gid://shopify/Customer/1001:gid://shopify/Order/5001:57']);
  const guest = await handleWebhook(await signed('orders/paid', { id: 5002, currency: 'EUR', subtotal_price: '20.00', customer: null }), d);
  assertEquals((await guest.json()).result, 'no_points');
  const other = await handleWebhook(await signed('orders/paid', { id: 1 }, 'whsec', 'evil.myshopify.com'), d);
  assertEquals((await other.json()).ignored, 'shop');
});

Deno.test('webhooks: compliance topics', async () => {
  const d = hookDeps();
  assertEquals((await (await handleWebhook(await signed('customers/data_request', { shop_domain: 'suppcity.myshopify.com', customer: { id: 1001 }, orders_requested: [1] }), d)).json()).result, 'queued');
  assertEquals((await (await handleWebhook(await signed('customers/redact', { shop_domain: 'suppcity.myshopify.com', customer: { id: 1001 }, orders_to_redact: [] }), d)).json()).result, 'redacted');
  assertEquals((await (await handleWebhook(await signed('customers/redact', { shop_domain: 'suppcity.myshopify.com', customer: { id: 9 } }), d)).json()).result, 'no_data');
  assertEquals((await handleWebhook(await signed('shop/redact', { shop_domain: 'suppcity.myshopify.com', shop_id: 1 }), d)).status, 200);
  assertEquals(d.log2, [
    'privacy:customers/data_request:received',
    'delete:u-1', 'privacy:customers/redact:completed',
    'privacy:customers/redact:no_data',
    'redact_shop', 'privacy:shop/redact:completed',
  ]);
  const failing = hookDeps({ awardOrderPoints: async () => { throw new Error('db down'); } });
  assertEquals((await handleWebhook(await signed('orders/paid', { id: 1, currency: 'EUR', subtotal_price: '5.00', customer: { id: 1 } }), failing)).status, 500);
});

// ---------------- redeem ----------------
function redeemDeps(shopify: ShopifyCreateResult[], over: Partial<RedeemDeps> = {}) {
  const rows = new Map<string, Redemption>();
  const events: string[] = [];
  let balance = 600;
  const deps: RedeemDeps = {
    userFromJwt: async (j) => (j === 'valid' ? { id: 'u-1' } : null),
    customerGidFor: async () => 'gid://shopify/Customer/1001',
    reserve: async (_u, id, tier) => {
      const existing = rows.get(id);
      if (existing) return existing;
      if (tier !== 'eur5') throw new Error('unknown_tier');
      if (balance < 500) throw new Error('insufficient_points');
      balance -= 500;
      const r: Redemption = { id, points: 500, value_cents: 500, min_order_cents: 2500, valid_days: 90, status: 'pending', discount_code: null, expires_at: null };
      rows.set(id, r);
      return r;
    },
    markIssued: async (id, code, _d, exp) => { const r = { ...rows.get(id)!, status: 'issued' as const, discount_code: code, expires_at: exp }; rows.set(id, r); events.push('issued'); return r; },
    markFailed: async (id) => { const r = rows.get(id)!; if (r.status === 'pending') { rows.set(id, { ...r, status: 'failed' }); balance += 500; } events.push('failed'); },
    createDiscount: async () => { events.push('create'); return shopify.shift() ?? { kind: 'unavailable', detail: 'none' }; },
    findDiscountByCode: async () => 'gid://shopify/DiscountCodeNode/9',
    codeSecret: 'k',
    now: () => new Date('2026-10-15T00:00:00Z'),
    log: () => {},
    ...over,
  };
  return { deps, events, rows, balance: () => balance };
}
const RID = '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e';

Deno.test('redeem: happy path, replay returns same code without second debit', async () => {
  const t = redeemDeps([{ kind: 'created', discountId: 'gid://shopify/DiscountCodeNode/1' }]);
  const r1 = await handleRedeem(post({ tierId: 'eur5', redemptionId: RID }), 'valid', t.deps);
  assertEquals(r1.status, 200);
  const b1 = await r1.json();
  assert(/^SC-/.test(b1.code), 'code');
  assertEquals(b1.expiresAt, '2027-01-13T00:00:00.000Z');
  const r2 = await handleRedeem(post({ tierId: 'eur5', redemptionId: RID }), 'valid', t.deps);
  assertEquals((await r2.json()).code, b1.code);
  assertEquals(t.events, ['create', 'issued']);
  assertEquals(t.balance(), 100);
});

Deno.test('redeem: Shopify down → pending, retry with same id finishes (code taken → lookup)', async () => {
  const t = redeemDeps([{ kind: 'unavailable', detail: '503' }, { kind: 'user_errors', errors: [{ code: 'TAKEN', message: 'Code must be unique' }] }]);
  const r1 = await handleRedeem(post({ tierId: 'eur5', redemptionId: RID }), 'valid', t.deps);
  assertEquals(r1.status, 503);
  assertEquals((await r1.json()).error, 'redeem_pending');
  const r2 = await handleRedeem(post({ tierId: 'eur5', redemptionId: RID }), 'valid', t.deps);
  assertEquals(r2.status, 200);
  assertEquals(t.balance(), 100);
});

Deno.test('redeem: definitive Shopify error refunds; insufficient/unknown/unlinked/unauth', async () => {
  const t = redeemDeps([{ kind: 'user_errors', errors: [{ code: 'INVALID', message: 'bad' }] }]);
  assertEquals((await handleRedeem(post({ tierId: 'eur5', redemptionId: RID }), 'valid', t.deps)).status, 502);
  assertEquals(t.balance(), 600);
  const poor = redeemDeps([]);
  await handleRedeem(post({ tierId: 'eur5', redemptionId: RID }), 'valid', { ...poor.deps, createDiscount: async () => ({ kind: 'created', discountId: 'x' }) });
  assertEquals((await (await handleRedeem(post({ tierId: 'eur5', redemptionId: '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4f' }), 'valid', poor.deps)).json()).error, 'insufficient_points');
  assertEquals((await (await handleRedeem(post({ tierId: 'gold', redemptionId: RID.replace('e', 'a') }), 'valid', redeemDeps([]).deps)).json()).error, 'unknown_tier');
  assertEquals((await handleRedeem(post({ tierId: 'eur5', redemptionId: 'not-uuid' }), 'valid', redeemDeps([]).deps)).status, 400);
  assertEquals((await handleRedeem(post({ tierId: 'eur5', redemptionId: RID }), null, redeemDeps([]).deps)).status, 401);
  assertEquals((await handleRedeem(post({ tierId: 'eur5', redemptionId: RID }), 'valid', { ...redeemDeps([]).deps, customerGidFor: async () => null })).status, 409);
});
