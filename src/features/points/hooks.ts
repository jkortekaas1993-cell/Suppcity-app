import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  FunctionCallError,
  getSupabase,
  type PointsLedgerEntry,
  type PointsRedeemTier,
  type RedeemPointsResponse,
} from '@/lib/supabase';

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
  | { status: 'busy'; tierId: string }
  | { status: 'done'; result: RedeemPointsResponse }
  | { status: 'error'; message: string; retryable: boolean };

export function redeemErrorMessage(e: unknown): { message: string; retryable: boolean } {
  const code = e instanceof FunctionCallError ? e.code : 'network';
  switch (code) {
    case 'insufficient_points':
      return { message: 'Je hebt niet genoeg punten.', retryable: false };
    case 'not_linked':
      return { message: 'Log in met je Supp City-account om punten in te wisselen.', retryable: false };
    case 'redeem_failed':
      return { message: 'Inwisselen is mislukt. Je punten zijn teruggezet.', retryable: false };
    case 'redeem_pending':
    case 'network':
      return { message: 'Geen verbinding met de shop. Probeer het opnieuw.', retryable: true };
    default:
      return { message: 'Er ging iets mis. Probeer het later opnieuw.', retryable: true };
  }
}

/**
 * Redeem with a stable idempotency key: retries of the same tier reuse the same
 * redemptionId, so a lost response can never debit twice.
 */
export function useRedeem(newId: () => string, service?: PointsService, onDone?: () => void) {
  const svc = useMemo(() => service ?? createPointsService(getSupabase()), [service]);
  const [state, setState] = useState<RedeemState>({ status: 'idle' });
  const pending = useRef<{ tierId: string; redemptionId: string } | null>(null);

  const redeem = useCallback(
    async (tierId: string) => {
      if (!pending.current || pending.current.tierId !== tierId) {
        pending.current = { tierId, redemptionId: newId() };
      }
      setState({ status: 'busy', tierId });
      try {
        const result = await svc.redeem(pending.current);
        pending.current = null;
        setState({ status: 'done', result });
        onDone?.();
      } catch (e) {
        const { message, retryable } = redeemErrorMessage(e);
        if (!retryable) pending.current = null;
        setState({ status: 'error', message, retryable });
      }
    },
    [svc, newId, onDone],
  );

  return { state, redeem, reset: () => setState({ status: 'idle' }) };
}
