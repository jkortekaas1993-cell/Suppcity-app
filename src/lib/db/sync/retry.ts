/** Retry with exponential backoff and full jitter. Pure apart from the injected sleep. */

export interface RetryOptions {
  retries: number;
  baseMs: number;
  maxMs: number;
  sleep: (ms: number) => Promise<void>;
  random?: () => number;
  isRetryable?: (err: unknown) => boolean;
}

export function backoffDelay(attempt: number, baseMs: number, maxMs: number, random: () => number = Math.random): number {
  const cap = Math.min(maxMs, baseMs * 2 ** attempt);
  return Math.floor(random() * cap);
}

/**
 * Errors that will not get better by retrying: Postgres/PostgREST client errors
 * (RLS 42501, constraint 23xxx, bad request 22xxx/PGRST1xx) and HTTP 4xx except 408/429.
 */
export function isRetryableError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return true;
  const e = err as { code?: unknown; status?: unknown };
  if (typeof e.code === 'string' && /^(22|23|42|PGRST1)/.test(e.code)) return false;
  if (typeof e.status === 'number' && e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429) {
    return false;
  }
  return true;
}

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  const retryable = opts.isRetryable ?? isRetryableError;
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= opts.retries || !retryable(err)) throw err;
      await opts.sleep(backoffDelay(attempt, opts.baseMs, opts.maxMs, opts.random));
    }
  }
}
