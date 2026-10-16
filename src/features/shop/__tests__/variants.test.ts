import type { ProductVariant } from '@/lib/shopify';

import { formatDateNl, productCount } from '../logic/format';
import { defaultVariantId, isSoldOut, sellableVariants, variantGroupLabel } from '../logic/variants';

const eur = (cents: number) => ({ cents, currencyCode: 'EUR' });
const variant = (id: string, available: boolean, flavour = id): ProductVariant => ({
  id,
  title: flavour,
  available,
  price: eur(6999),
  compareAtPrice: null,
  image: null,
  options: [{ name: 'Smaak', value: flavour }],
});

describe('variants', () => {
  it('hides sold-out flavours and selects the first one in stock', () => {
    const p = { variants: [variant('a', false), variant('b', true), variant('c', true)] };
    expect(sellableVariants(p).map((v) => v.id)).toEqual(['b', 'c']);
    expect(defaultVariantId(p)).toBe('b');
    expect(isSoldOut(p)).toBe(false);
  });

  it('marks the product sold out only when every variant is', () => {
    const p = { variants: [variant('a', false), variant('b', false)] };
    expect(isSoldOut(p)).toBe(true);
    expect(defaultVariantId(p)).toBeNull();
    expect(sellableVariants(p)).toEqual([]);
  });

  it('labels the chips with the single option name', () => {
    expect(variantGroupLabel({ variants: [variant('a', true)] })).toBe('Smaak');
    const two = { ...variant('b', true), options: [{ name: 'Smaak', value: 'x' }, { name: 'Inhoud', value: '1 kg' }] };
    expect(variantGroupLabel({ variants: [two] })).toBe('Variant');
  });
});

describe('format', () => {
  it('formats dates in Dutch without dateStyle', () => {
    expect(formatDateNl('2026-10-16T10:00:00Z')).toMatch(/16 oktober 2026/);
    expect(formatDateNl('2026-10-16T10:00:00Z', 'monthYear')).toMatch(/oktober 2026/);
    expect(formatDateNl('garbage')).toBe('');
  });
  it('counts products', () => {
    expect(productCount(1)).toBe('1 product');
    expect(productCount(3)).toBe('3 producten');
  });
});
