import type { z } from 'zod';

import { ShopifyApiError } from './errors';

/**
 * Minimal fetch signature so pure modules (and tests) do not depend on DOM or
 * React Native typings. The global `fetch` satisfies it.
 */
export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export interface GraphQLRequest<S extends z.ZodTypeAny> {
  endpoint: string;
  headers: Record<string, string>;
  query: string;
  variables?: Record<string, unknown>;
  /** Schema for `data` (not the whole envelope). */
  schema: S;
  fetchImpl: FetchLike;
}

interface GraphQLEnvelope {
  data?: unknown;
  errors?: { message?: string; extensions?: { code?: string } }[];
}

/** POST a GraphQL operation and validate `data` with zod at the boundary. */
export async function graphqlRequest<S extends z.ZodTypeAny>(req: GraphQLRequest<S>): Promise<z.infer<S>> {
  let res: Awaited<ReturnType<FetchLike>>;
  try {
    res = await req.fetchImpl(req.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...req.headers },
      body: JSON.stringify({ query: req.query, variables: req.variables ?? {} }),
    });
  } catch (cause) {
    throw new ShopifyApiError('network', 'Network request failed', cause);
  }
  if (res.status === 401 || res.status === 403) {
    throw new ShopifyApiError('unauthorized', `HTTP ${res.status}`, undefined, res.status);
  }
  if (!res.ok) throw new ShopifyApiError('http', `HTTP ${res.status}`, undefined, res.status);

  let json: GraphQLEnvelope;
  try {
    json = (await res.json()) as GraphQLEnvelope;
  } catch (cause) {
    throw new ShopifyApiError('invalid_response', 'Response is not JSON', cause, res.status);
  }
  if (json.errors && json.errors.length > 0) {
    const unauthorized = json.errors.some((e) => e.extensions?.code === 'UNAUTHORIZED' || e.extensions?.code === 'ACCESS_DENIED');
    throw new ShopifyApiError(unauthorized ? 'unauthorized' : 'graphql', 'GraphQL error', json.errors, res.status);
  }
  const parsed = req.schema.safeParse(json.data);
  if (!parsed.success) {
    throw new ShopifyApiError('invalid_response', 'Unexpected response shape', parsed.error.issues, res.status);
  }
  return parsed.data;
}

/** The runtime's global fetch (React Native, Node 18+), typed as FetchLike. */
export function defaultFetch(): FetchLike {
  const f = (globalThis as { fetch?: unknown }).fetch;
  if (typeof f !== 'function') throw new Error('fetch is not available in this runtime');
  return f as FetchLike;
}
