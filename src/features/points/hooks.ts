import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  getSupabase,
  type PointsLedgerEntry,
  type PointsRedeemTier,
  type RedeemPointsResponse,
} from '@/lib/supabase';

import { redeemErrorMessage } from './errors';
import { redeemTier, resumePendingRedemption, type PendingRedemptionStore, type RedeemOutcome } from './redeemFlow';
import { createPointsService, type PointsService } from './service';

export interface PointsState {
  loading: boolean;
  error: string | null;
  balance: number;
  history: PointsLedgerEntry[];
  tiers: PointsRedeemTier[];
  refresh: () => Promise<void>;
}

/** Balance, history and redeem tiers for the signed-in user. */
export function usePoints(service?: PointsService): PointsState {
  const svc = useMemo(() => service ?? createPointsService(getSupabase()), [service]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [history, setHistory] = useState<PointsLedgerEntry[]>([]);
  const [tiers, setTiers] = useState<PointsRedeemTier[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [b, h, t] = await Promise.all([svc.balance(), svc.history(), svc.tiers()]);
      setBalance(b);
      setHistory(h);
      setTiers(t);
    } catch {
      setError('Punten konden niet worden geladen.');
    } finally {
      setLoading(false);
    }
  }, [svc]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { loading, error, balance, history, tiers, refresh };
}

export type RedeemState =
  | { status: 'idle' }
  | { status: 'busy'; tierId: string | null }
  | { status: 'done'; result: RedeemPointsResponse }
  | { status: 'error'; message: string; retryable: boolean };

export { redeemErrorMessage };

/**
 * Redeem with a stable idempotency key that survives an app restart (review M5):
 * the key lives in `store` (app_state) until the server gives a definitive answer.
 * On mount, a redemption left over from an earlier run is finished first.
 */
export function useRedeem(newId: () => string, store: PendingRedemptionStore, service?: PointsService, onDone?: () => void) {
  const svc = useMemo(() => service ?? createPointsService(getSupabase()), [service]);
  const [state, setState] = useState<RedeemState>({ status: 'idle' });

  const apply = useCallback(
    (out: RedeemOutcome) => {
      setState(out.status === 'done' ? { status: 'done', result: out.result } : out);
      if (out.status === 'done') onDone?.();
    },
    [onDone],
  );

  useEffect(() => {
    let alive = true;
    void resumePendingRedemption(svc, store)
      .then((out) => {
        if (alive && out) apply(out);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [svc, store, apply]);

  const redeem = useCallback(
    async (tierId: string) => {
      setState({ status: 'busy', tierId });
      apply(await redeemTier(svc, store, tierId, newId));
    },
    [svc, store, newId, apply],
  );

  return { state, redeem, reset: () => setState({ status: 'idle' }) };
}

export interface AdultState {
  confirmed: boolean | null;
  busy: boolean;
  error: string | null;
  confirm: () => Promise<void>;
}

/** 18+ self-declaration (hard rule 5); null while unknown. */
export function useAdultConfirmation(service?: PointsService, onConfirmed?: () => void): AdultState {
  const svc = useMemo(() => service ?? createPointsService(getSupabase()), [service]);
  const [confirmed, setConfirmed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    svc
      .adultConfirmed()
      .then((v) => alive && setConfirmed(v))
      .catch(() => alive && setConfirmed(null));
    return () => {
      alive = false;
    };
  }, [svc]);

  const confirm = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await svc.confirmAdult();
      setConfirmed(true);
      onConfirmed?.();
    } catch {
      setError('Bevestigen lukte niet. Probeer het later opnieuw.');
    } finally {
      setBusy(false);
    }
  }, [svc, onConfirmed]);

  return { confirmed, busy, error, confirm };
}
