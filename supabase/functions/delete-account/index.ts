// STUB — Backend&Sync builder implements (hard rule 3).
//
// POST (authenticated) -> 204
// Deletes the caller's auth user; all public.* rows cascade via FK on delete cascade.
// Shopify customer data is NOT deleted here (separate shop retention rules); log the
// request for the GDPR register without storing body/health data.
import { json } from '../_shared/cors.ts';

Deno.serve((_req: Request) => json({ error: 'not_implemented' }, 501));
