import type { Money } from './money';

/** App-side models (framework-free). UI never sees raw GraphQL shapes. */
export interface ShopImage {
  url: string;
  alt: string;
}

export interface Collection {
  id: string;
  handle: string;
  title: string;
  description: string;
  image: ShopImage | null;
}

export interface ProductSummary {
  id: string;
  handle: string;
  title: string;
  image: ShopImage | null;
  priceFrom: Money;
  available: boolean;
}

export interface ProductVariant {
  id: string;
  title: string;
  available: boolean;
  price: Money;
  compareAtPrice: Money | null;
  image: ShopImage | null;
  options: { name: string; value: string }[];
}

export interface ProductDetail extends ProductSummary {
  description: string;
  vendor: string | null;
  images: ShopImage[];
  variants: ProductVariant[];
  /** True when the only variant is Shopify's implicit "Default Title". */
  hasOnlyDefaultVariant: boolean;
  /** Product page on suppcity.nl, null when not published to the Online Store. */
  onlineStoreUrl: string | null;
  /**
   * Raw claim ids from the `suppcity.claim_ids` metafield. The UI only renders them
   * through getApprovedClaim() (hard rule 4); unknown/unapproved ids render nothing.
   */
  claimIds: string[];
}

export interface VariantAvailability {
  variantId: string;
  productTitle: string;
  variantTitle: string;
  available: boolean;
}

export interface CartLine {
  id: string;
  quantity: number;
  variantId: string;
  variantTitle: string | null;
  productTitle: string;
  productHandle: string;
  image: ShopImage | null;
  unitPrice: Money;
  lineTotal: Money;
  available: boolean;
}

export interface Cart {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  subtotal: Money;
  total: Money;
  discountCodes: { code: string; applicable: boolean }[];
  lines: CartLine[];
}

export interface Page<T> {
  items: T[];
  hasNextPage: boolean;
  endCursor: string | null;
}

export interface CartMutationResult {
  cart: Cart;
  /** Non-blocking warnings (e.g. quantity reduced due to stock), Dutch-ready text from Shopify. */
  warnings: { code: string; message: string }[];
}

export interface OrderLine {
  id: string;
  title: string;
  variantTitle: string | null;
  quantity: number;
  /** Null for custom/deleted items: cannot be reordered. */
  variantId: string | null;
  productId: string | null;
  image: ShopImage | null;
  total: Money | null;
  isGiftCard: boolean;
}

export interface OrderSummary {
  id: string;
  name: string;
  number: number;
  processedAt: string;
  financialStatus: string | null;
  fulfillmentStatus: string | null;
  total: Money;
  lines: OrderLine[];
}

export interface OrderDetail extends OrderSummary {
  subtotal: Money | null;
  shipping: Money;
  tax: Money | null;
}

export interface CustomerProfile {
  id: string;
  firstName: string | null;
  email: string | null;
}

export interface NewCartLine {
  variantId: string;
  quantity: number;
}
