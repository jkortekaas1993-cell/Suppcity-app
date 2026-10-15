// Minimal Admin GraphQL client (pinned version). Pure: fetch injected.
import { SHOPIFY_ADMIN_API_VERSION } from './config.ts';

export interface AdminGraphqlResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  errors?: unknown;
}

export function adminGraphqlUrl(shopDomain: string): string {
  return `https://${shopDomain}/admin/api/${SHOPIFY_ADMIN_API_VERSION}/graphql.json`;
}

export async function adminGraphql<T>(
  fetchFn: typeof fetch,
  shopDomain: string,
  token: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<AdminGraphqlResult<T>> {
  try {
    const res = await fetchFn(adminGraphqlUrl(shopDomain), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
      body: JSON.stringify({ query, variables }),
    });
    const body = (await res.json().catch(() => ({}))) as { data?: T; errors?: unknown };
    return { ok: res.ok && !body.errors, status: res.status, data: body.data, errors: body.errors };
  } catch (e) {
    return { ok: false, status: 0, errors: String(e) };
  }
}
