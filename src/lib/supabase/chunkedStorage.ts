/**
 * Supabase session storage over a small key/value secure store (review M7).
 * SecureStore values can be limited to ~2 KB, and a Supabase session (access token
 * JWT + refresh token + user) is often larger. Values are split into chunks under
 * `<key>.<i>`, with a manifest `<key>` = `chunks:<n>`. Pure: the store is injected.
 */
export interface SecureKv {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export const CHUNK_SIZE = 1800;
const MANIFEST = /^chunks:(\d{1,4})$/;

export function createChunkedStorage(kv: SecureKv, chunkSize = CHUNK_SIZE): SecureKv {
  async function chunkCount(key: string): Promise<number> {
    const m = MANIFEST.exec((await kv.getItem(key)) ?? '');
    return m ? Number(m[1]) : 0;
  }
  async function removeChunks(key: string, from: number, to: number): Promise<void> {
    for (let i = from; i < to; i++) await kv.removeItem(`${key}.${i}`);
  }
  return {
    async getItem(key) {
      const head = await kv.getItem(key);
      if (head === null) return null;
      const m = MANIFEST.exec(head);
      if (!m) return head; // small value stored directly (or written before chunking)
      const parts: string[] = [];
      for (let i = 0; i < Number(m[1]); i++) {
        const part = await kv.getItem(`${key}.${i}`);
        if (part === null) return null; // torn write: treat as signed out
        parts.push(part);
      }
      return parts.join('');
    },
    async setItem(key, value) {
      const previous = await chunkCount(key);
      if (value.length <= chunkSize && !MANIFEST.test(value)) {
        await kv.setItem(key, value);
        await removeChunks(key, 0, previous);
        return;
      }
      const n = Math.ceil(value.length / chunkSize);
      // Chunks first, manifest last: a crash mid-write never yields a mixed value.
      for (let i = 0; i < n; i++) await kv.setItem(`${key}.${i}`, value.slice(i * chunkSize, (i + 1) * chunkSize));
      await kv.setItem(key, `chunks:${n}`);
      await removeChunks(key, n, previous);
    },
    async removeItem(key) {
      const n = await chunkCount(key);
      await kv.removeItem(key);
      await removeChunks(key, 0, n);
    },
  };
}
