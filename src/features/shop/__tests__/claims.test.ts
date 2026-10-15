import { CLAIMS } from '@/content/claims';

import { approvedClaimsFor } from '../logic/claims';
import { productFacts, productPageUrl } from '../logic/productInfo';

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

describe('product info without the free-text description (C1)', () => {
  it('shows variant options as facts, never the description', () => {
    const variant = { options: [{ name: 'Inhoud', value: '500 g' }, { name: 'Smaak', value: 'Vanille' }] };
    expect(productFacts({ hasOnlyDefaultVariant: false }, variant)).toEqual([
      { label: 'Inhoud', value: '500 g' },
      { label: 'Smaak', value: 'Vanille' },
    ]);
    expect(productFacts({ hasOnlyDefaultVariant: true }, variant)).toEqual([]);
    expect(productFacts({ hasOnlyDefaultVariant: false }, { options: [{ name: 'Title', value: 'Default Title' }] })).toEqual([]);
  });
  it('links only to https suppcity.nl', () => {
    expect(productPageUrl({ handle: 'creatine', onlineStoreUrl: 'https://suppcity.nl/products/creatine' })).toBe('https://suppcity.nl/products/creatine');
    expect(productPageUrl({ handle: 'creatine', onlineStoreUrl: 'https://evil.example/x' })).toBe('https://suppcity.nl/products/creatine');
    expect(productPageUrl({ handle: 'a b', onlineStoreUrl: null })).toBe('https://suppcity.nl/products/a%20b');
  });
});
