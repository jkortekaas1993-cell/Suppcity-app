import { ColorScheme, ShopifyCheckoutSheet } from '@shopify/checkout-sheet-kit';

/**
 * Thin wrapper around @shopify/checkout-sheet-kit 3.x (Shopify's native checkout sheet).
 * A single module-level instance, so no provider is needed in app/_layout.tsx.
 * Payments, taxes and discounts stay with Shopify (ADR-2).
 */
const sheet = new ShopifyCheckoutSheet({ colorScheme: ColorScheme.automatic });

export interface CheckoutHandlers {
  /** Order placed. `orderId` is the Shopify order gid when provided. */
  onCompleted(orderId: string | null): void;
  /** Sheet dismissed without completing. */
  onClose?(): void;
  onError?(message: string): void;
}

/** Start loading checkout in the background (cart screen open). */
export function preloadCheckout(checkoutUrl: string): void {
  try {
    sheet.preload(checkoutUrl);
  } catch {
    // Preload is an optimisation only.
  }
}

/** Present checkout and wire lifecycle events. Returns a cleanup function. */
export function presentCheckout(checkoutUrl: string, handlers: CheckoutHandlers): () => void {
  const subs = [
    sheet.addEventListener('completed', (event) => {
      handlers.onCompleted(event.orderDetails?.id ?? null);
    }),
    sheet.addEventListener('close', () => handlers.onClose?.()),
    sheet.addEventListener('error', (error) => handlers.onError?.(error.message)),
  ];
  sheet.present(checkoutUrl);
  return () => subs.forEach((s) => s?.remove());
}
