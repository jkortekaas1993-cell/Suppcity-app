/**
 * Dutch date formatting with explicit Intl options. `dateStyle` is avoided on purpose:
 * Hermes on Android does not support it everywhere.
 */
export function formatDateNl(iso: string, style: 'long' | 'short' | 'dayMonth' | 'monthYear' = 'long'): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  switch (style) {
    case 'long':
      return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
    case 'short':
      return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
    case 'dayMonth':
      return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' });
    case 'monthYear':
      return date.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' });
  }
}

/** "1 product" / "3 producten". */
export function productCount(n: number): string {
  return `${n} ${n === 1 ? 'product' : 'producten'}`;
}
