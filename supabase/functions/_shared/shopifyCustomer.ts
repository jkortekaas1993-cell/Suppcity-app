// Server-side verification of a Shopify Customer Account API access token. Pure:
// fetch is injected. The token is valid only if Shopify itself answers the
// `customer` query with it; the customer id comes from Shopify, never from the client.
import { z } from 'zod';

import { SHOPIFY_CUSTOMER_ACCOUNT_API_VERSION } from './config.ts';

export const CUSTOMER_QUERY = 'query VerifyCustomer { customer { id } }';

const CustomerResponse = z.object({
  data: z
    .object({ customer: z.object({ id: z.string().regex(/^gid:\/\/shopify\/Customer\/\d+$/) }).nullable() })
    .nullable()
    .optional(),
  errors: z.array(z.object({ message: z.string() }).passthrough()).optional(),
});

export type VerifyResult =
  | { ok: true; customerGid: string }
  | { ok: false; reason: 'invalid_token' | 'unavailable'; detail?: string };

/** e.g. https://suppcity.nl/customer/api/2026-10/graphql (storefront domain, pinned version). */
export function customerApiUrl(storefrontDomain: string, override?: string): string {
  if (override) return override;
  const host = storefrontDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  return `https://${host}/customer/api/${SHOPIFY_CUSTOMER_ACCOUNT_API_VERSION}/graphql`;
}

export async function verifyCustomerToken(
  accessToken: string,
  url: string,
  fetchFn: typeof fetch,
): Promise<VerifyResult> {
  let res: Response;
  try {
    res = await fetchFn(url, {
      method: 'POST',
      // Customer Account API: raw access token in Authorization (no "Bearer" prefix).
      headers: { 'Content-Type': 'application/json', Authorization: accessToken },
      body: JSON.stringify({ query: CUSTOMER_QUERY }),
    });
  } catch (e) {
    return { ok: false, reason: 'unavailable', detail: String(e) };
  }
  if (res.status === 401 || res.status === 403) return { ok: false, reason: 'invalid_token' };
  if (!res.ok) return { ok: false, reason: 'unavailable', detail: `HTTP ${res.status}` };
  const parsed = CustomerResponse.safeParse(await res.json().catch(() => null));
  if (!parsed.success) return { ok: false, reason: 'unavailable', detail: 'unexpected response' };
  const customer = parsed.data.data?.customer;
  if (!customer) return { ok: false, reason: 'invalid_token', detail: parsed.data.errors?.[0]?.message };
  return { ok: true, customerGid: customer.id };
}
