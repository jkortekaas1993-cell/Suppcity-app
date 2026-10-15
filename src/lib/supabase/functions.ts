import type { SupabaseClient } from '@supabase/supabase-js';
import type { ZodType } from 'zod';

import { FunctionCallError, FunctionErrorBody } from './contracts';

/** Narrow view of supabase-js `functions.invoke` errors (FunctionsHttpError carries the Response). */
interface InvokeError {
  name?: string;
  message?: string;
  context?: { status?: number; json?: () => Promise<unknown> };
}

/** Pure: map an invoke error to a FunctionCallError (exported for tests). */
export async function toFunctionCallError(error: InvokeError): Promise<FunctionCallError> {
  const ctx = error.context;
  if (!ctx || typeof ctx.status !== 'number') {
    return new FunctionCallError('network', 0, error.message);
  }
  const body = FunctionErrorBody.safeParse(await ctx.json?.().catch(() => null));
  return new FunctionCallError(body.success ? body.data.error : 'internal', ctx.status, body.success ? body.data.message : undefined);
}

/** Invoke an Edge Function and validate its response at the boundary. */
export async function invokeFunction<T>(
  client: SupabaseClient,
  name: string,
  body: unknown,
  schema: ZodType<T>,
): Promise<T> {
  const { data, error } = await client.functions.invoke(name, { body: body as Record<string, unknown> });
  if (error) throw await toFunctionCallError(error as InvokeError);
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new FunctionCallError('internal', 200, 'Unexpected response shape');
  return parsed.data;
}
