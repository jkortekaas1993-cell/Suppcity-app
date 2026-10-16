import { customerSession, getStorefront, secureKv, userMessageFor, type Cart, type CartLine, type NewCartLine } from '@/lib/shopify';

import { APP_DISCOUNT_CODE } from '../config';
import { lineChangeFor } from '../logic/cart';
import { createStore } from './createStore';

/**
 * Cart state. The cart id contains Shopify's secret key, so it is kept in SecureStore.
 */
const CART_ID_KEY = 'shop.cartId';

interface CartState {
  cart: Cart | null;
  busy: boolean;
  error: string | null;
  /** Non-blocking info (cart warnings, skipped reorder lines). */
  notice: string | null;
  loaded: boolean;
}

const store = createStore<CartState>({ cart: null, busy: false, error: null, notice: null, loaded: false });

async function persist(cart: Cart | null) {
  if (cart) await secureKv.setItem(CART_ID_KEY, cart.id);
  else await secureKv.removeItem(CART_ID_KEY);
}

async function run(fn: () => Promise<{ cart: Cart; warnings: { message: string }[] } | null>, notice?: string | null) {
  store.set({ busy: true, error: null });
  try {
    const result = await fn();
    if (result) {
      await persist(result.cart);
      const warning = result.warnings.map((w) => w.message).join(' ');
      store.set({ cart: result.cart, notice: [notice, warning].filter(Boolean).join(' ') || null });
    }
    return true;
  } catch (error) {
    store.set({ error: userMessageFor(error) });
    return false;
  } finally {
    store.set({ busy: false });
  }
}

async function createCart(lines: NewCartLine[]) {
  const customerAccessToken = await customerSession.accessTokenOrNull();
  return getStorefront().cartCreate({
    lines,
    customerAccessToken,
    discountCodes: APP_DISCOUNT_CODE ? [APP_DISCOUNT_CODE] : [],
  });
}

export const cartStore = {
  ...store,

  /** Restore the cart from a previous session. Completed/expired carts come back null. */
  async load() {
    if (store.get().loaded) return;
    const id = await secureKv.getItem(CART_ID_KEY).catch(() => null);
    if (!id) {
      store.set({ loaded: true });
      return;
    }
    try {
      const cart = await getStorefront().cart(id);
      if (!cart) await persist(null);
      store.set({ cart, loaded: true });
    } catch {
      store.set({ loaded: true }); // offline: keep id, retry next time
    }
  },

  /**
   * Adds lines to the existing cart (restored first, so a not-yet-loaded cart is never
   * replaced by a new one), or creates a cart. `notice`: info shown with the cart
   * (e.g. skipped reorder lines). Used by "Bestel"/"Opnieuw bestellen" too: those never
   * empty the cart.
   */
  async add(lines: NewCartLine[], notice: string | null = null) {
    await cartStore.load();
    const current = store.get().cart;
    return run(() => (current ? getStorefront().cartLinesAdd(current.id, lines) : createCart(lines)), notice);
  },

  setQuantity(line: Pick<CartLine, 'id' | 'quantity'>, quantity: number) {
    const cart = store.get().cart;
    if (!cart) return Promise.resolve(false);
    const change = lineChangeFor(line, quantity);
    if (change.kind === 'noop') return Promise.resolve(true);
    return run(() =>
      change.kind === 'remove'
        ? getStorefront().cartLinesRemove(cart.id, [change.lineId])
        : getStorefront().cartLinesUpdate(cart.id, [{ lineId: change.lineId, quantity: change.quantity }]),
    );
  },

  /**
   * Fresh checkout URL right before presenting. Authenticated checkout URLs expire,
   * so the buyer identity is (re)attached here when the customer is signed in.
   */
  async prepareCheckout(): Promise<string | null> {
    const cart = store.get().cart;
    if (!cart) return null;
    const token = await customerSession.accessTokenOrNull();
    if (!token) return cart.checkoutUrl;
    const ok = await run(() => getStorefront().cartBuyerIdentityUpdate(cart.id, token));
    return ok ? (store.get().cart?.checkoutUrl ?? null) : null;
  },

  /** After a completed checkout, or on logout (drops the buyer identity). */
  async reset() {
    await persist(null);
    store.set({ cart: null, notice: null, error: null });
  },

  dismissMessages() {
    store.set({ notice: null, error: null });
  },
};

export const useCart = () => cartStore.use();
