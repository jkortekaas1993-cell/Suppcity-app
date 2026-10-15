// Shared HTTP helpers for Edge Functions. Pure module (Web APIs only).
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
} as const;

export const jsonHeaders = { 'Content-Type': 'application/json', ...corsHeaders } as const;

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

/** Error body shared by all functions: { error: <machine code>, message? }. */
export function errorResponse(status: number, error: string, message?: string): Response {
  return json(message ? { error, message } : { error }, status);
}

export function preflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse(405, 'method_not_allowed');
  return null;
}

/** Bearer token from the Authorization header, or null. */
export function bearer(req: Request): string | null {
  const h = req.headers.get('Authorization') ?? '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m?.[1]?.trim() || null;
}
