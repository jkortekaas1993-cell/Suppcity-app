// Shared helpers for Edge Functions (Deno runtime). Owned by Backend&Sync.
export const jsonHeaders = { 'Content-Type': 'application/json' } as const;

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}
