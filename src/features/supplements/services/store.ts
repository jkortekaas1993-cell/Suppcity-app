import { useMemo, useSyncExternalStore } from 'react';

import { expoSqlDb, getSharedDatabase, newId, nowIso, useDatabase, type SqlDb } from '@/lib/db';

import { createSupplementRepository, type SupplementOwner, type SupplementRepository } from '../data/supplementRepository';

// --- owner: whose supplement rows are visible ---------------------------------------
// The app shell registers how to read the signed-in user (src/integration). Without it,
// everything runs as the anonymous (signed-out) owner.

let ownerResolver: () => Promise<string | null> = () => Promise.resolve(null);

/** Called once by the app shell: resolves the signed-in Supabase user id, or null. */
export function setSupplementOwnerResolver(resolve: () => Promise<string | null>): void {
  ownerResolver = resolve;
}

const currentOwner: SupplementOwner = () => ownerResolver().catch(() => null);

export function repositoryFor(db: SqlDb, owner: SupplementOwner = currentOwner): SupplementRepository {
  return createSupplementRepository(db, { newId, now: nowIso, owner });
}

/**
 * Repository for code outside React (app start, notification actions, wipe, export).
 * Uses the provider's connection (no second connection to the file); waits until
 * <DatabaseProvider> has migrated. `owner` pins the owner instead of the signed-in user
 * (used around sign-in/sign-out, when the session is about to change).
 */
export async function sharedRepository(opts: { db?: SqlDb; owner?: string | null } = {}): Promise<SupplementRepository> {
  const db = opts.db ?? (await getSharedDatabase());
  const pinned = opts.owner;
  return repositoryFor(db, pinned === undefined ? currentOwner : () => Promise.resolve(pinned));
}

/** Repository on the provider's connection, for screens. */
export function useSupplementRepository(): SupplementRepository {
  const db = useDatabase();
  return useMemo(() => repositoryFor(expoSqlDb(db)), [db]);
}

// --- change signal: screens and the Vandaag card reload after any write ------------

let version = 0;
const listeners = new Set<() => void>();

export function notifySupplementsChanged(): void {
  version += 1;
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Increments after every supplement write (in-app or from a notification action). */
export function useSupplementsVersion(): number {
  return useSyncExternalStore(subscribe, () => version, () => version);
}
