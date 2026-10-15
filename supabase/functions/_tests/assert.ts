// Tiny assertion helpers so tests need no network imports (`deno test supabase/functions/_tests`).
export function assert(cond: unknown, msg = 'assertion failed'): asserts cond {
  if (!cond) throw new Error(msg);
}
export function assertEquals<T>(got: T, want: T, msg = ''): void {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) throw new Error(`${msg} expected ${w}, got ${g}`);
}
