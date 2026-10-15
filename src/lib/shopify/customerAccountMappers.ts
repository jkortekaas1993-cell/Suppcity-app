import type { RawOrderDetail, RawOrderLineItem, RawOrderSummary } from './customerAccountSchemas';
import type { OrderDetail, OrderLine, OrderSummary } from './models';
import { parseMoney } from './money';

const DEFAULT_VARIANT_TITLE = 'Default Title';

export function mapOrderLine(raw: RawOrderLineItem): OrderLine {
  return {
    id: raw.id,
    title: raw.name,
    variantTitle: raw.variantTitle && raw.variantTitle !== DEFAULT_VARIANT_TITLE ? raw.variantTitle : null,
    quantity: raw.quantity,
    variantId: raw.variantId ?? null,
    productId: raw.productId ?? null,
    image: raw.image ? { url: raw.image.url, alt: raw.image.altText?.trim() || raw.name } : null,
    total: raw.totalPrice ? parseMoney(raw.totalPrice) : null,
    isGiftCard: raw.giftCard === true,
  };
}

export function mapOrderSummary(raw: RawOrderSummary): OrderSummary {
  return {
    id: raw.id,
    name: raw.name,
    number: raw.number,
    processedAt: raw.processedAt,
    financialStatus: raw.financialStatus ?? null,
    fulfillmentStatus: raw.fulfillmentStatus ?? null,
    total: parseMoney(raw.totalPrice),
    lines: raw.lineItems.nodes.map(mapOrderLine),
  };
}

export function mapOrderDetail(raw: RawOrderDetail): OrderDetail {
  return {
    ...mapOrderSummary(raw),
    subtotal: raw.subtotal ? parseMoney(raw.subtotal) : null,
    shipping: parseMoney(raw.totalShipping),
    tax: raw.totalTax ? parseMoney(raw.totalTax) : null,
  };
}

const FULFILLMENT_NL: Record<string, string> = {
  FULFILLED: 'Verzonden',
  PARTIALLY_FULFILLED: 'Deels verzonden',
  IN_PROGRESS: 'In behandeling',
  PENDING_FULFILLMENT: 'In behandeling',
  ON_HOLD: 'In de wacht',
  SCHEDULED: 'Gepland',
  UNFULFILLED: 'Wordt verwerkt',
  OPEN: 'Wordt verwerkt',
  RESTOCKED: 'Retour verwerkt',
};

const FINANCIAL_NL: Record<string, string> = {
  PAID: 'Betaald',
  PENDING: 'Betaling in behandeling',
  AUTHORIZED: 'Betaling geautoriseerd',
  PARTIALLY_PAID: 'Deels betaald',
  PARTIALLY_REFUNDED: 'Deels terugbetaald',
  REFUNDED: 'Terugbetaald',
  VOIDED: 'Geannuleerd',
  EXPIRED: 'Verlopen',
};

/** Dutch status label for order lists. Refund/void wins over shipping state. */
export function orderStatusLabel(order: Pick<OrderSummary, 'financialStatus' | 'fulfillmentStatus'>): string {
  const fin = order.financialStatus ?? '';
  if (fin === 'REFUNDED' || fin === 'VOIDED' || fin === 'PARTIALLY_REFUNDED') return FINANCIAL_NL[fin] ?? fin;
  const ful = order.fulfillmentStatus ?? '';
  return FULFILLMENT_NL[ful] ?? FINANCIAL_NL[fin] ?? 'Besteld';
}
