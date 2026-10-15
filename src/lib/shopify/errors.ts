/** Error kinds shared by the Storefront and Customer Account clients. */
export type ShopifyErrorKind =
  | 'network' // fetch threw (offline, DNS, TLS)
  | 'http' // non-2xx status
  | 'graphql' // top-level GraphQL `errors`
  | 'invalid_response' // response did not match the zod schema
  | 'user_error' // mutation returned userErrors
  | 'unauthorized'; // 401 / expired customer token

export class ShopifyApiError extends Error {
  constructor(
    readonly kind: ShopifyErrorKind,
    message: string,
    readonly details?: unknown,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ShopifyApiError';
  }
}

/** Kept for backwards compatibility with the foundation export. */
export { ShopifyApiError as StorefrontError };

/** Short, user-facing Dutch message. Never shows raw API text. */
export function userMessageFor(error: unknown): string {
  if (error instanceof ShopifyApiError) {
    switch (error.kind) {
      case 'network':
        return 'Geen verbinding. Controleer je internet en probeer het opnieuw.';
      case 'unauthorized':
        return 'Je sessie is verlopen. Log opnieuw in.';
      case 'user_error':
        return 'Dat lukte niet. Probeer het opnieuw.';
      default:
        return 'De shop is even niet bereikbaar. Probeer het later opnieuw.';
    }
  }
  return 'Er ging iets mis. Probeer het opnieuw.';
}
