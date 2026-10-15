/**
 * APPROVED CLAIM SENTENCES — the ONLY place product/health claims may come from (hard rule 4).
 *
 * - Sentences are taken verbatim from the EU Register of nutrition and health claims
 *   (Regulation (EU) No 432/2012) in their Dutch wording, and approved by Supp City.
 * - Never generate, paraphrase or combine claims in code, AI output or CMS text.
 * - Each claim may only be shown for a product that meets its condition of use;
 *   that check is product data (Shopify metafield), not app logic.
 * - Adding/changing a claim = PR reviewed by the owner. Fill `approvedBy`/`approvedAt`.
 *
 * Placeholders below are NOT yet approved (approvedAt: null) and must not render.
 */

export interface ApprovedClaim {
  id: ClaimId;
  nutrient: string;
  text: string;
  /** Condition of use, summarised, for reviewers. */
  condition: string;
  approvedBy: string | null;
  approvedAt: string | null;
}

export type ClaimId = 'creatine_performance' | 'protein_muscle_mass' | 'vitamin_c_fatigue';

export const CLAIMS: Readonly<Record<ClaimId, ApprovedClaim>> = {
  creatine_performance: {
    id: 'creatine_performance',
    nutrient: 'Creatine',
    text: 'Creatine verhoogt de lichamelijke prestaties bij opeenvolgende korte perioden van zeer intensieve lichamelijke inspanning.',
    condition: 'Min. 3 g creatine per dag; volwassenen die zeer intensief sporten.',
    approvedBy: null,
    approvedAt: null,
  },
  protein_muscle_mass: {
    id: 'protein_muscle_mass',
    nutrient: 'Eiwit',
    text: 'Eiwitten dragen bij tot de groei van de spiermassa.',
    condition: 'Product is minstens een "bron van eiwitten" volgens de Verordening (EG) nr. 1924/2006.',
    approvedBy: null,
    approvedAt: null,
  },
  vitamin_c_fatigue: {
    id: 'vitamin_c_fatigue',
    nutrient: 'Vitamine C',
    text: 'Vitamine C helpt vermoeidheid en futloosheid te verminderen.',
    condition: 'Product bevat min. een significante hoeveelheid vitamine C (15% RI).',
    approvedBy: null,
    approvedAt: null,
  },
};

/** Returns the claim text only if it has been approved; otherwise null (render nothing). */
export function getApprovedClaim(id: ClaimId): string | null {
  const claim = CLAIMS[id];
  return claim.approvedAt && claim.approvedBy ? claim.text : null;
}
