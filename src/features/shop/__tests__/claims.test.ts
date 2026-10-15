import { CLAIMS } from '@/content/claims';

import { approvedClaimsFor } from '../logic/claims';

describe('approvedClaimsFor (hard rule 4)', () => {
  it('renders nothing for unapproved, unknown or prototype ids', () => {
    expect(approvedClaimsFor(['creatine_performance', 'made_up', 'toString', '__proto__'])).toEqual([]);
  });
  it('returns verbatim text only once approved', () => {
    const claim = CLAIMS.protein_muscle_mass as { approvedBy: string | null; approvedAt: string | null; text: string };
    const before = { by: claim.approvedBy, at: claim.approvedAt };
    claim.approvedBy = 'test';
    claim.approvedAt = '2026-10-15';
    try {
      expect(approvedClaimsFor(['protein_muscle_mass', 'protein_muscle_mass'])).toEqual([claim.text]);
    } finally {
      claim.approvedBy = before.by;
      claim.approvedAt = before.at;
    }
  });
});
