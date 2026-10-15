// Public API of the Shopify integration (Storefront + Customer Account).
// Framework-free modules first; native wiring (SecureStore, WebBrowser) is in customerAuthNative.
export * from './errors';
export * from './money';
export type * from './models';
export type { FetchLike } from './http';
export { createStorefrontClient, storefrontEndpoint, type StorefrontClient } from './storefront';
export { getStorefront } from './storefrontDefault';
export { orderStatusLabel } from './customerAccountMappers';
export type { CustomerAccountClient } from './customerAccount';
export {
  customerTokens,
  getCustomerAccount,
  onCustomerSignedOut,
  signInWithShopify,
  signOutFromShopify,
  type SignInResult,
} from './customerAuthNative';
export { preloadCheckout, presentCheckout, type CheckoutHandlers } from './checkout';
export { secureKv } from './secureKv';
export type { KeyValueStore } from './customerSession';
export { customerSession, useCustomerSession, type CustomerSessionStatus } from './customerSessionStore';
