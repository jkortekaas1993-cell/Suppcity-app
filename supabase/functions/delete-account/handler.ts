// delete-account (hard rule 3): deletes the CALLER's auth user; every public.* row
// cascades (FK on delete cascade). public.delete_account() logs an anonymous
// confirmation in the same transaction. Orders stay in Shopify (shop retention).
import { errorResponse, json, preflight } from '../_shared/cors.ts';
import type { DeleteAccountResponse } from '../_shared/contracts.ts';

export interface DeleteAccountDeps {
  /** Resolve the user from the caller's JWT (verified by GoTrue), or null. */
  userFromJwt(jwt: string): Promise<{ id: string } | null>;
  deleteAccount(userId: string): Promise<string | null>;
  log(event: string, data?: Record<string, unknown>): void;
}

export async function handleDeleteAccount(req: Request, jwt: string | null, deps: DeleteAccountDeps): Promise<Response> {
  const early = preflight(req);
  if (early) return early;
  if (!jwt) return errorResponse(401, 'unauthorized');
  const user = await deps.userFromJwt(jwt);
  if (!user) return errorResponse(401, 'unauthorized');
  try {
    const confirmationId = await deps.deleteAccount(user.id);
    if (!confirmationId) return errorResponse(401, 'unauthorized');
    deps.log('deleted', { confirmationId }); // no user id in logs
    const body: DeleteAccountResponse = { confirmationId, deletedAt: new Date().toISOString() };
    return json(body);
  } catch (e) {
    deps.log('delete_error', { message: String(e) });
    return errorResponse(500, 'internal');
  }
}
