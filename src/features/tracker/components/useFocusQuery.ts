import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

/**
 * Loads data whenever the screen gains focus (so lists refresh after editing
 * elsewhere). `load` must be stable (wrap it in useCallback at the call site).
 */
export function useFocusQuery<T>(load: () => Promise<T>): {
  data: T | undefined;
  loading: boolean;
  error: unknown;
  reload: () => void;
} {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [nonce, setNonce] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      load()
        .then((value) => {
          if (!active) return;
          setData(value);
          setError(null);
        })
        .catch((err: unknown) => {
          if (active) setError(err);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
      // nonce forces a reload on demand
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load, nonce]),
  );

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, loading, error, reload };
}
