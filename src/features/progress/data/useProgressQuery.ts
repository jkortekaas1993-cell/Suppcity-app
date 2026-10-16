import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useDatabase } from '@/lib/db';
import { currentUserId } from '@/lib/supabase';

import type { ReadDb } from './queries';

/** Signed-in Supabase user id, or null (signed out, or a build without Supabase env). */
async function safeUserId(): Promise<string | null> {
  try {
    return await currentUserId();
  } catch {
    return null;
  }
}

export interface ProgressQuery<T> {
  data: T | undefined;
  loading: boolean;
  error: unknown;
}

/**
 * Runs a read-only progress query whenever the screen gains focus (so numbers refresh
 * after a finished workout). `load` must be stable (useCallback at the call site).
 * Data stays on the device: nothing here is sent anywhere (hard rule 1).
 */
export function useProgressQuery<T>(load: (db: ReadDb, userId: string | null) => Promise<T>): ProgressQuery<T> {
  const db = useDatabase();
  const [state, setState] = useState<ProgressQuery<T>>({ data: undefined, loading: true, error: null });

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setState((s) => ({ ...s, loading: true }));
      safeUserId()
        .then((uid) => load(db, uid))
        .then((data) => {
          if (active) setState({ data, loading: false, error: null });
        })
        .catch((error: unknown) => {
          if (active) setState((s) => ({ ...s, loading: false, error }));
        });
      return () => {
        active = false;
      };
    }, [db, load]),
  );

  return state;
}
