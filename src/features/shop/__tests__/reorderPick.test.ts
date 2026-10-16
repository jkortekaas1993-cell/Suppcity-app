import { pickMostUrgent, type ExternalReorderSignal } from '../logic/reorderPick';
import { estimateStock, type StockItemInput } from '../logic/stock';

const TODAY = '2026-10-16';

function stockItem(id: string, variantId: string | null, servingsLeftDays: number): { item: StockItemInput; estimate: ReturnType<typeof estimateStock> } {
  const item: StockItemInput = {
    id,
    productTitle: `Product ${id}`,
    variantId,
    packageAmount: servingsLeftDays * 5,
    servingAmount: 5,
    unit: 'g',
    servingsPerDay: 1,
    packages: 1,
    startedOn: TODAY,
    remindDaysBefore: 30,
  };
  return { item, estimate: estimateStock(item, TODAY) };
}

const ext = (variantGid: string, daysLeft: number): ExternalReorderSignal => ({ variantGid, productTitle: `Supp ${variantGid}`, daysLeft });

describe('pickMostUrgent', () => {
  it('returns null when nothing is due', () => {
    expect(pickMostUrgent([], [])).toBeNull();
  });

  it('picks the fewest days left across both sources', () => {
    const pick = pickMostUrgent([stockItem('a', 'gid://v/1', 6)], [ext('gid://v/2', 3)]);
    expect(pick).toEqual({ source: 'external', signal: ext('gid://v/2', 3) });
  });

  it('keeps a stock item when it is more urgent', () => {
    const pick = pickMostUrgent([stockItem('a', 'gid://v/1', 2)], [ext('gid://v/2', 3)]);
    expect(pick?.source).toBe('stock');
  });

  it('dedupes the same variant and keeps the lower estimate', () => {
    const s = stockItem('a', 'gid://v/1', 6);
    const pick = pickMostUrgent([s], [ext('gid://v/1', 4), ext('gid://v/3', 5)]);
    expect(pick).toEqual({ source: 'external', signal: ext('gid://v/1', 4) });
  });

  it('prefers the stock counter on a tie', () => {
    const pick = pickMostUrgent([stockItem('a', 'gid://v/1', 4)], [ext('gid://v/1', 4)]);
    expect(pick?.source).toBe('stock');
  });

  it('handles stock items without a variant', () => {
    const pick = pickMostUrgent([stockItem('a', null, 1)], [ext('gid://v/2', 3)]);
    expect(pick?.source).toBe('stock');
  });
});
