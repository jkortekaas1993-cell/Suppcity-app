import { randomUUID } from 'expo-crypto';
import { z } from 'zod';

import { STOCK_UNITS, type StockItemInput } from '../logic/stock';
import { createStore } from './createStore';
import { localKv } from './localKv';

/**
 * Stock counter items, stored locally on the device only (no sync yet).
 * Only product/dosage fields the user typed in (hard rule 1).
 * TODO(Backend&Sync + Tracker): move to a local `stock_items` table and sync it
 * with public.stock_items (servings_total = packageAmount*packages/servingAmount).
 */
const KEY = 'shop.stockItems.v1';

const itemSchema = z.object({
  id: z.string(),
  productTitle: z.string(),
  variantId: z.string().nullable(),
  packageAmount: z.number(),
  servingAmount: z.number(),
  unit: z.enum(STOCK_UNITS as [StockItemInput['unit'], ...StockItemInput['unit'][]]),
  servingsPerDay: z.number(),
  packages: z.number(),
  startedOn: z.string(),
  remindDaysBefore: z.number(),
});

const store = createStore<{ items: StockItemInput[]; loaded: boolean }>({ items: [], loaded: false });

async function save(items: StockItemInput[]) {
  store.set({ items });
  await localKv.setItem(KEY, JSON.stringify(items));
}

export const stockStore = {
  ...store,
  async load() {
    if (store.get().loaded) return;
    try {
      const raw = await localKv.getItem(KEY);
      const parsed = z.array(itemSchema).safeParse(raw ? JSON.parse(raw) : []);
      store.set({ items: parsed.success ? parsed.data : [], loaded: true });
    } catch {
      store.set({ loaded: true });
    }
  },
  get(id: string): StockItemInput | undefined {
    return store.get().items.find((i) => i.id === id);
  },
  async upsert(item: Omit<StockItemInput, 'id'> & { id?: string }): Promise<StockItemInput> {
    const full: StockItemInput = { ...item, id: item.id ?? randomUUID() };
    const items = store.get().items.filter((i) => i.id !== full.id);
    await save([...items, full]);
    return full;
  },
  async remove(id: string) {
    await save(store.get().items.filter((i) => i.id !== id));
  },
  /** New package: restart the counter today with the same dosage. */
  async restart(id: string, today: string) {
    const item = stockStore.get(id);
    if (item) await stockStore.upsert({ ...item, startedOn: today });
  },
  /** Account deletion / logout wipe. */
  async clear() {
    await save([]);
  },
};

export const useStock = () => stockStore.use();
