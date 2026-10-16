import { createStore } from '../state/createStore';

// The hook only needs to hand React the right snapshot; render-free check.
jest.mock('react', () => ({
  useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) => getSnapshot(),
}));

describe('createStore', () => {
  it('use() keeps reading the full state when a spreading store overrides get', () => {
    const base = createStore({ items: [1, 2], loaded: true });
    // Same shape as stockStore: spread, then a `get(id)` with another meaning.
    const derived = {
      ...base,
      get: (id: number) => base.get().items.find((i) => i === id),
    };
    expect(derived.use()).toEqual({ items: [1, 2], loaded: true });
  });

  it('notifies subscribers on set', () => {
    const s = createStore({ n: 0 });
    let calls = 0;
    const off = s.subscribe(() => calls++);
    s.set({ n: 1 });
    off();
    s.set({ n: 2 });
    expect(calls).toBe(1);
    expect(s.get().n).toBe(2);
  });
});
