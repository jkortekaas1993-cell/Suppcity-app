// shopify-webhooks: one endpoint for orders/paid and the mandatory compliance topics.
// 1. Verify X-Shopify-Hmac-Sha256 over the RAW body → 401 on failure (required by Shopify).
// 2. Check the shop domain. 3. Route by X-Shopify-Topic. Always 200 once handled so
// Shopify stops retrying; duplicates are safe (idempotent DB writes).
import { errorResponse, json } from '../_shared/cors.ts';
import { verifyShopifyHmac } from '../_shared/hmac.ts';
import { OrderPaidPayload, pointsForOrder } from '../_shared/orderPoints.ts';
import { asTopic, CustomerPrivacyPayload, sameShop, ShopRedactPayload } from '../_shared/webhookRouting.ts';

export type PrivacyStatus = 'received' | 'completed' | 'no_data';

export interface WebhookDeps {
  secrets: readonly (string | undefined)[];
  shopDomain: string;
  awardOrderPoints(customerGid: string, orderGid: string, points: number): Promise<string>;
  /** Returns false if this webhook id was already recorded (duplicate delivery). */
  recordPrivacyRequest(r: {
    topic: string;
    webhookId: string | null;
    shopDomain: string;
    customerGid: string | null;
    status: PrivacyStatus;
  }): Promise<boolean>;
  hasCustomerData(customerGid: string): Promise<boolean>;
  findUserByCustomer(customerGid: string): Promise<string | null>;
  deleteAccount(userId: string): Promise<void>;
  redactShop(): Promise<void>;
  log(event: string, data?: Record<string, unknown>): void;
}

export async function handleWebhook(req: Request, deps: WebhookDeps): Promise<Response> {
  if (req.method !== 'POST') return errorResponse(405, 'method_not_allowed');
  const raw = new Uint8Array(await req.arrayBuffer());
  if (!(await verifyShopifyHmac(raw, req.headers.get('X-Shopify-Hmac-Sha256'), deps.secrets))) {
    return errorResponse(401, 'unauthorized');
  }
  const shopHeader = req.headers.get('X-Shopify-Shop-Domain');
  if (!sameShop(shopHeader, deps.shopDomain)) {
    deps.log('wrong_shop');
    return json({ ignored: 'shop' });
  }
  const topic = asTopic(req.headers.get('X-Shopify-Topic'));
  const webhookId = req.headers.get('X-Shopify-Webhook-Id');
  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return errorResponse(400, 'bad_request');
  }

  try {
    switch (topic) {
      case 'orders/paid': {
        const p = OrderPaidPayload.safeParse(body);
        if (!p.success) return errorResponse(400, 'bad_request');
        const { orderGid, customerGid, points } = pointsForOrder(p.data);
        if (!customerGid || points <= 0) return json({ result: 'no_points' });
        const result = await deps.awardOrderPoints(customerGid, orderGid, points);
        deps.log('order_points', { result, points });
        return json({ result });
      }
      case 'customers/data_request': {
        const p = CustomerPrivacyPayload.safeParse(body);
        if (!p.success) return errorResponse(400, 'bad_request');
        const customerGid = `gid://shopify/Customer/${p.data.customer.id}`;
        const has = await deps.hasCustomerData(customerGid);
        // 'received' → owner exports via select export_customer_data(gid) and sends it
        // to the shop owner within 30 days (see README). No personal data in logs.
        await deps.recordPrivacyRequest({
          topic, webhookId, shopDomain: p.data.shop_domain, customerGid, status: has ? 'received' : 'no_data',
        });
        return json({ result: has ? 'queued' : 'no_data' });
      }
      case 'customers/redact': {
        const p = CustomerPrivacyPayload.safeParse(body);
        if (!p.success) return errorResponse(400, 'bad_request');
        const customerGid = `gid://shopify/Customer/${p.data.customer.id}`;
        const userId = await deps.findUserByCustomer(customerGid);
        if (userId) await deps.deleteAccount(userId);
        await deps.recordPrivacyRequest({
          topic, webhookId, shopDomain: p.data.shop_domain, customerGid: null, status: userId ? 'completed' : 'no_data',
        });
        return json({ result: userId ? 'redacted' : 'no_data' });
      }
      case 'shop/redact': {
        const p = ShopRedactPayload.safeParse(body);
        if (!p.success) return errorResponse(400, 'bad_request');
        await deps.redactShop();
        await deps.recordPrivacyRequest({
          topic, webhookId, shopDomain: p.data.shop_domain, customerGid: null, status: 'completed',
        });
        return json({ result: 'redacted' });
      }
      default:
        return json({ ignored: 'topic' });
    }
  } catch (e) {
    deps.log('webhook_error', { topic, message: String(e) });
    return errorResponse(500, 'internal'); // Shopify retries
  }
}
