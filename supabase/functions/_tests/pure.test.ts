import { SHOPIFY_API_VERSION as APP_SHOPIFY_API_VERSION } from '../../../src/lib/config/constants.ts';
import { SHOPIFY_ADMIN_API_VERSION, SHOPIFY_API_VERSION, SHOPIFY_CUSTOMER_ACCOUNT_API_VERSION } from '../_shared/config.ts';
import { computeShopifyHmac, verifyShopifyHmac } from '../_shared/hmac.ts';
import { decimalToCents, OrderPaidPayload, pointsForOrder } from '../_shared/orderPoints.ts';
import { buildDiscountInput, centsToDecimal, deriveDiscountCode, isCodeTaken } from '../_shared/redeem.ts';
import { customerApiUrl, verifyCustomerToken } from '../_shared/shopifyCustomer.ts';
import { assert, assertEquals } from './assert.ts';

const enc = new TextEncoder();

Deno.test('pinned API versions: one version everywhere, same as the app', () => {
  assertEquals(SHOPIFY_API_VERSION, APP_SHOPIFY_API_VERSION);
  assertEquals(SHOPIFY_CUSTOMER_ACCOUNT_API_VERSION, SHOPIFY_API_VERSION);
  assertEquals(SHOPIFY_ADMIN_API_VERSION, SHOPIFY_API_VERSION);
});

Deno.test('HMAC: valid, tampered, wrong secret, rotation, garbage header', async () => {
  const body = enc.encode('{"id":1}');
  const sig = await computeShopifyHmac('s3cret', body);
  assert(await verifyShopifyHmac(body, sig, ['s3cret']), 'valid');
  assert(!(await verifyShopifyHmac(enc.encode('{"id":2}'), sig, ['s3cret'])), 'tampered body');
  assert(!(await verifyShopifyHmac(body, sig, ['other'])), 'wrong secret');
  assert(await verifyShopifyHmac(body, sig, ['new', 's3cret']), 'old secret during rotation');
  assert(!(await verifyShopifyHmac(body, null, ['s3cret'])), 'missing header');
  assert(!(await verifyShopifyHmac(body, '!!notbase64', ['s3cret'])), 'garbage header');
  assert(!(await verifyShopifyHmac(body, sig, [undefined, ''])), 'no secret configured');
});

Deno.test('HMAC matches a known vector (RFC 4231 case 2)', async () => {
  // key "Jefe", data "what do ya want for nothing?" → 5bdcc146bf60754e6a042426089575c7...
  const b64 = await computeShopifyHmac('Jefe', enc.encode('what do ya want for nothing?'));
  const hex = Array.from(atob(b64), (c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
  assertEquals(hex, '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');
});

Deno.test('decimalToCents', () => {
  assertEquals(decimalToCents('57.99'), 5799);
  assertEquals(decimalToCents('0.1'), 10);
  assertEquals(decimalToCents('100'), 10000);
  assertEquals(decimalToCents('19.999'), 1999);
  assertEquals(decimalToCents('abc'), null);
});

Deno.test('order points: floor of discounted subtotal excl. shipping, EUR only', () => {
  const base = {
    id: 820982911946154508,
    admin_graphql_api_id: 'gid://shopify/Order/820982911946154508',
    currency: 'EUR',
    current_subtotal_price_set: { shop_money: { amount: '57.99', currency_code: 'EUR' } },
    customer: { id: 115310627314723950 },
  };
  const r = pointsForOrder(OrderPaidPayload.parse(base));
  assertEquals(r.points, 57);
  assertEquals(r.orderGid, 'gid://shopify/Order/820982911946154508');
  assert(r.customerGid?.startsWith('gid://shopify/Customer/'), 'customer gid');
  assertEquals(pointsForOrder(OrderPaidPayload.parse({ ...base, current_subtotal_price_set: { shop_money: { amount: '0.99', currency_code: 'EUR' } } })).points, 0);
  assertEquals(pointsForOrder(OrderPaidPayload.parse({ ...base, current_subtotal_price_set: { shop_money: { amount: '50.00', currency_code: 'USD' } } })).points, 0);
  assertEquals(pointsForOrder(OrderPaidPayload.parse({ ...base, test: true })).points, 0);
  assertEquals(pointsForOrder(OrderPaidPayload.parse({ ...base, customer: null })).customerGid, null);
  // gift card of €25 in a €57.99 subtotal → 32 points
  assertEquals(pointsForOrder(OrderPaidPayload.parse({ ...base, line_items: [{ gift_card: true, price: '25.00', quantity: 1 }, { price: '32.99', quantity: 1 }] })).points, 32);
  // fallback to subtotal_price
  assertEquals(pointsForOrder(OrderPaidPayload.parse({ id: 5, currency: 'EUR', subtotal_price: '12.50', customer: { id: 1 } })).points, 12);
});

Deno.test('discount code derivation is deterministic, secret-bound and readable', async () => {
  const a = await deriveDiscountCode('dddddddd-0000-0000-0000-000000000001', 'k1');
  assertEquals(a, await deriveDiscountCode('dddddddd-0000-0000-0000-000000000001', 'k1'));
  assert(a !== (await deriveDiscountCode('dddddddd-0000-0000-0000-000000000001', 'k2')), 'secret-bound');
  assert(a !== (await deriveDiscountCode('dddddddd-0000-0000-0000-000000000002', 'k1')), 'id-bound');
  assert(/^SC-[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/.test(a), `format ${a}`);
});

Deno.test('discount input: fixed amount, single use, customer-bound', () => {
  const now = new Date('2026-10-15T10:00:00Z');
  const input = buildDiscountInput(
    { id: 'dddddddd-0000', points: 500, value_cents: 500, min_order_cents: 2500, valid_days: 90, status: 'pending', discount_code: null, expires_at: null },
    'SC-AAAAA-BBBBB', 'gid://shopify/Customer/1', now,
  );
  assertEquals(input.customerGets.value.discountAmount.amount, '5.00');
  assertEquals(input.minimumRequirement?.subtotal.greaterThanOrEqualToSubtotal, '25.00');
  assertEquals(input.context.customers.add, ['gid://shopify/Customer/1']);
  assertEquals(input.usageLimit, 1);
  assertEquals(input.endsAt, '2027-01-13T10:00:00.000Z');
  assertEquals(centsToDecimal(1250), '12.50');
  assert(isCodeTaken([{ code: 'TAKEN', message: 'x' }]), 'TAKEN');
  assert(isCodeTaken([{ message: 'Code must be unique' }]), 'message');
  assert(!isCodeTaken([{ code: 'INVALID', message: 'bad date' }]), 'other');
});

function fakeFetch(status: number, body: unknown, seen?: { init?: RequestInit; url?: string }): typeof fetch {
  return (async (url: string, init?: RequestInit) => {
    if (seen) { seen.url = url; seen.init = init; }
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
}

Deno.test('customer token verification', async () => {
  const url = customerApiUrl('https://suppcity.nl/');
  assertEquals(url, 'https://suppcity.nl/customer/api/2026-10/graphql');
  const seen: { init?: RequestInit } = {};
  const ok = await verifyCustomerToken('tok', url, fakeFetch(200, { data: { customer: { id: 'gid://shopify/Customer/42' } } }, seen));
  assertEquals(ok, { ok: true, customerGid: 'gid://shopify/Customer/42' });
  assertEquals((seen.init?.headers as Record<string, string>).Authorization, 'tok');
  assertEquals((await verifyCustomerToken('t', url, fakeFetch(401, {}))).ok, false);
  const bad = await verifyCustomerToken('t', url, fakeFetch(200, { data: { customer: null }, errors: [{ message: 'Unauthorized' }] }));
  assertEquals(bad.ok ? '' : bad.reason, 'invalid_token');
  const weird = await verifyCustomerToken('t', url, fakeFetch(200, { data: { customer: { id: 'not-a-gid' } } }));
  assertEquals(weird.ok ? '' : weird.reason, 'unavailable');
  const down = await verifyCustomerToken('t', url, fakeFetch(503, {}));
  assertEquals(down.ok ? '' : down.reason, 'unavailable');
  const thrown = await verifyCustomerToken('t', url, (async () => { throw new Error('dns'); }) as unknown as typeof fetch);
  assertEquals(thrown.ok ? '' : thrown.reason, 'unavailable');
});
