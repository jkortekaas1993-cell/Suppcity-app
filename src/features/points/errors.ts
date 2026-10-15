import { FunctionCallError } from '@/lib/supabase';

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
