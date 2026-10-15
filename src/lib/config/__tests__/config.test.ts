import { customerAccountScheme } from '../../../../app.config';
import { parseEnv } from '../env';
import { POLICY_VERSION, SHOPIFY_API_VERSION, SHOPIFY_CUSTOMER_ACCOUNT_API_VERSION, SHOPIFY_STOREFRONT_API_VERSION } from '../constants';

describe('app config', () => {
  it('rejects incomplete env config', () => {
    expect(() => parseEnv({})).toThrow(/Invalid app config/);
  });

  it('pins ONE Shopify API version for every API (hard rule 7)', () => {
    expect(SHOPIFY_API_VERSION).toMatch(/^\d{4}-(01|04|07|10)$/);
    expect(SHOPIFY_STOREFRONT_API_VERSION).toBe(SHOPIFY_API_VERSION);
    expect(SHOPIFY_CUSTOMER_ACCOUNT_API_VERSION).toBe(SHOPIFY_API_VERSION);
  });

  it('has a consent policy version', () => {
    expect(POLICY_VERSION.length).toBeGreaterThan(0);
  });

  it('derives the Customer Account callback scheme from the shop id', () => {
    expect(customerAccountScheme('12345')).toBe('shop.12345.app');
    expect(customerAccountScheme(' 12345 ')).toBe('shop.12345.app');
    expect(customerAccountScheme(undefined)).toBeNull();
    expect(customerAccountScheme('replace-with-numeric-shop-id')).toBeNull();
  });
});
