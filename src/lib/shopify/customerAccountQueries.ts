/** Customer Account API GraphQL documents. Version pinned via SHOPIFY_CUSTOMER_ACCOUNT_API_VERSION. */
const LINE_ITEM = `
  id
  name
  quantity
  variantId
  productId
  variantTitle
  sku
  giftCard
  image { url altText }
  totalPrice { amount currencyCode }
`;

const ORDER_SUMMARY = `
  id
  name
  number
  processedAt
  financialStatus
  fulfillmentStatus
  totalPrice { amount currencyCode }
  lineItems(first: 50) { nodes { ${LINE_ITEM} } }
`;

export const CUSTOMER_PROFILE_QUERY = /* GraphQL */ `
  query CustomerProfile {
    customer { id firstName emailAddress { emailAddress } }
  }
`;

export const CUSTOMER_ORDERS_QUERY = /* GraphQL */ `
  query CustomerOrders($first: Int!, $after: String) {
    customer {
      orders(first: $first, after: $after, sortKey: PROCESSED_AT, reverse: true) {
        nodes { ${ORDER_SUMMARY} }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

export const ORDER_QUERY = /* GraphQL */ `
  query Order($id: ID!) {
    order(id: $id) {
      ${ORDER_SUMMARY}
      subtotal { amount currencyCode }
      totalShipping { amount currencyCode }
      totalTax { amount currencyCode }
    }
  }
`;
