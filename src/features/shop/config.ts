import { normaliseDiscountCode } from './logic/cart';

/**
 * App discount code shown once in the welcome card and applied to new carts.
 * Set EXPO_PUBLIC_SHOPIFY_APP_DISCOUNT_CODE (create the code in Shopify first).
 * Read literally so Expo inlines it at build time.
 */
export const APP_DISCOUNT_CODE: string | null = normaliseDiscountCode(process.env.EXPO_PUBLIC_SHOPIFY_APP_DISCOUNT_CODE);
