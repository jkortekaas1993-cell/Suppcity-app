/**
 * Storefront API GraphQL documents (version pinned in SHOPIFY_STOREFRONT_API_VERSION).
 * `@inContext(country: NL, language: NL)` gives Dutch content and EUR prices.
 */
const IMAGE = `url altText width height`;

const PRODUCT_CARD = /* GraphQL */ `
  fragment ProductCard on Product {
    id
    handle
    title
    availableForSale
    featuredImage { ${IMAGE} }
    priceRange { minVariantPrice { amount currencyCode } }
  }
`;

const CART = /* GraphQL */ `
  fragment CartFields on Cart {
    id
    checkoutUrl
    totalQuantity
    cost {
      subtotalAmount { amount currencyCode }
      totalAmount { amount currencyCode }
    }
    discountCodes { code applicable }
    lines(first: 100) {
      nodes {
        id
        quantity
        cost {
          totalAmount { amount currencyCode }
          amountPerQuantity { amount currencyCode }
        }
        merchandise {
          ... on ProductVariant {
            id
            title
            availableForSale
            image { ${IMAGE} }
            product { id handle title }
          }
        }
      }
    }
  }
`;

const CART_PAYLOAD = `
  cart { ...CartFields }
  userErrors { field message code }
  warnings { code message target }
`;

export const COLLECTIONS_QUERY = /* GraphQL */ `
  query Collections($first: Int!) @inContext(country: NL, language: NL) {
    collections(first: $first, sortKey: TITLE) {
      nodes { id handle title description image { ${IMAGE} } }
    }
  }
`;

export const PRODUCTS_QUERY = /* GraphQL */ `
  ${PRODUCT_CARD}
  query Products($first: Int!, $after: String, $query: String) @inContext(country: NL, language: NL) {
    products(first: $first, after: $after, query: $query, sortKey: BEST_SELLING) {
      nodes { ...ProductCard }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

export const COLLECTION_PRODUCTS_QUERY = /* GraphQL */ `
  ${PRODUCT_CARD}
  query CollectionProducts($handle: String!, $first: Int!, $after: String) @inContext(country: NL, language: NL) {
    collection(handle: $handle) {
      id handle title description image { ${IMAGE} }
      products(first: $first, after: $after) {
        nodes { ...ProductCard }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

export const PRODUCT_QUERY = /* GraphQL */ `
  ${PRODUCT_CARD}
  query Product($handle: String!) @inContext(country: NL, language: NL) {
    product(handle: $handle) {
      ...ProductCard
      description
      vendor
      productType
      onlineStoreUrl
      claimIds: metafield(namespace: "suppcity", key: "claim_ids") { value }
      images(first: 10) { nodes { ${IMAGE} } }
      variants(first: 50) {
        nodes {
          id
          title
          availableForSale
          price { amount currencyCode }
          compareAtPrice { amount currencyCode }
          image { ${IMAGE} }
          selectedOptions { name value }
        }
      }
    }
  }
`;

/** Used by reorder: current availability for variant ids taken from a past order. */
export const VARIANTS_BY_ID_QUERY = /* GraphQL */ `
  query VariantsById($ids: [ID!]!) @inContext(country: NL, language: NL) {
    nodes(ids: $ids) {
      ... on ProductVariant {
        id
        title
        availableForSale
        price { amount currencyCode }
        compareAtPrice { amount currencyCode }
        image { ${IMAGE} }
        selectedOptions { name value }
        product { id handle title }
      }
    }
  }
`;

export const CART_QUERY = /* GraphQL */ `
  ${CART}
  query Cart($id: ID!) @inContext(country: NL, language: NL) {
    cart(id: $id) { ...CartFields }
  }
`;

export const CART_CREATE_MUTATION = /* GraphQL */ `
  ${CART}
  mutation CartCreate($input: CartInput!) @inContext(country: NL, language: NL) {
    cartCreate(input: $input) { ${CART_PAYLOAD} }
  }
`;

export const CART_LINES_ADD_MUTATION = /* GraphQL */ `
  ${CART}
  mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) @inContext(country: NL, language: NL) {
    cartLinesAdd(cartId: $cartId, lines: $lines) { ${CART_PAYLOAD} }
  }
`;

export const CART_LINES_UPDATE_MUTATION = /* GraphQL */ `
  ${CART}
  mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) @inContext(country: NL, language: NL) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) { ${CART_PAYLOAD} }
  }
`;

export const CART_LINES_REMOVE_MUTATION = /* GraphQL */ `
  ${CART}
  mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) @inContext(country: NL, language: NL) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) { ${CART_PAYLOAD} }
  }
`;

export const CART_BUYER_IDENTITY_UPDATE_MUTATION = /* GraphQL */ `
  ${CART}
  mutation CartBuyerIdentityUpdate($cartId: ID!, $buyerIdentity: CartBuyerIdentityInput!)
  @inContext(country: NL, language: NL) {
    cartBuyerIdentityUpdate(cartId: $cartId, buyerIdentity: $buyerIdentity) { ${CART_PAYLOAD} }
  }
`;

export const CART_DISCOUNT_CODES_UPDATE_MUTATION = /* GraphQL */ `
  ${CART}
  mutation CartDiscountCodesUpdate($cartId: ID!, $discountCodes: [String!]!) @inContext(country: NL, language: NL) {
    cartDiscountCodesUpdate(cartId: $cartId, discountCodes: $discountCodes) { ${CART_PAYLOAD} }
  }
`;
