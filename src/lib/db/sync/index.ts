// Public API of the sync layer (Backend&Sync). The app depends on `SyncEngine` only.
export { CustomSyncEngine, type CustomSyncOptions } from './engine';
export { fromRemote, isOwnedBy, isSyncable, SYNC_COLUMNS, toRemote } from './mapping';
export { chunk, compareTimestamps, mergeRow } from './merge';
export { backoffDelay, isRetryableError, withRetry, type RetryOptions } from './retry';
export { createSupabaseSyncAdapter, keysetFilter } from './supabaseAdapter';
export * from './types';
