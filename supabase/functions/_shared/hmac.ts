// Shopify webhook HMAC verification. Pure (WebCrypto), runs in Deno and Node >= 20.
// Shopify signs the RAW request body with HMAC-SHA256 using the app's client secret
// and sends it base64-encoded in X-Shopify-Hmac-Sha256. During secret rotation both
// the old and new secret must be accepted, hence a list of secrets.

const encoder = new TextEncoder();

async function hmacSha256(secret: string, body: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, body as BufferSource));
}

export function base64Encode(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function base64Decode(s: string): Uint8Array | null {
  try {
    const bin = atob(s.trim());
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/** Constant-time comparison (length is not secret: always 32 bytes for SHA-256). */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

export async function computeShopifyHmac(secret: string, rawBody: Uint8Array): Promise<string> {
  return base64Encode(await hmacSha256(secret, rawBody));
}

export async function verifyShopifyHmac(
  rawBody: Uint8Array,
  header: string | null,
  secrets: readonly (string | undefined)[],
): Promise<boolean> {
  if (!header) return false;
  const given = base64Decode(header);
  if (!given || given.length !== 32) return false;
  let ok = false;
  for (const secret of secrets) {
    if (!secret) continue;
    // no early return: same work for every secret
    if (timingSafeEqual(await hmacSha256(secret, rawBody), given)) ok = true;
  }
  return ok;
}
