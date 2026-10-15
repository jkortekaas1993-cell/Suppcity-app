import { randomUUID } from 'expo-crypto';

/** Client-side UUID v4 for every local row (offline-first, idempotent sync). */
export function newId(): string {
  return randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}
