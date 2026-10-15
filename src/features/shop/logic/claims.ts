import { CLAIMS, getApprovedClaim, type ClaimId } from '@/content/claims';

/**
 * Hard rule 4: product claims ONLY via getApprovedClaim(). Shopify supplies claim
 * ids (metafield suppcity.claim_ids); unknown or unapproved ids render nothing.
 */
export function approvedClaimsFor(ids: readonly string[]): string[] {
  const out: string[] = [];
  for (const id of new Set(ids)) {
    if (!Object.prototype.hasOwnProperty.call(CLAIMS, id)) continue;
    const text = getApprovedClaim(id as ClaimId);
    if (text) out.push(text);
  }
  return out;
}
