import { z } from 'zod';

/** Money as integer minor units (cents) to avoid float drift in sums. */
export interface Money {
  cents: number;
  currencyCode: string;
}

export const moneyV2Schema = z.object({
  amount: z.string(),
  currencyCode: z.string(),
});
export type MoneyV2 = z.infer<typeof moneyV2Schema>;

export function parseMoney(raw: MoneyV2): Money {
  const value = Number.parseFloat(raw.amount);
  if (!Number.isFinite(value)) throw new Error(`Invalid money amount: ${raw.amount}`);
  return { cents: Math.round(value * 100), currencyCode: raw.currencyCode };
}

export function addMoney(a: Money, b: Money): Money {
  if (a.currencyCode !== b.currencyCode) throw new Error('Currency mismatch');
  return { cents: a.cents + b.cents, currencyCode: a.currencyCode };
}

export function multiplyMoney(m: Money, factor: number): Money {
  return { cents: Math.round(m.cents * factor), currencyCode: m.currencyCode };
}

/** "€ 24,95" (nl-NL). Falls back to a manual format if Intl is unavailable. */
export function formatMoney(m: Money): string {
  const value = m.cents / 100;
  try {
    return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: m.currencyCode }).format(value);
  } catch {
    const symbol = m.currencyCode === 'EUR' ? '€' : m.currencyCode;
    return `${symbol} ${value.toFixed(2).replace('.', ',')}`;
  }
}
