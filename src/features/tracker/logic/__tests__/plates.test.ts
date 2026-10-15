import { calculatePlates } from '../plates';

describe('calculatePlates', () => {
  it('loads 100 kg as 25 + 15 per side', () => {
    const r = calculatePlates(100);
    expect(r.perSide).toEqual([
      { plateKg: 25, count: 1 },
      { plateKg: 15, count: 1 },
    ]);
    expect(r.loadedKg).toBe(100);
    expect(r.remainderKg).toBe(0);
  });
  it('handles fractional plates exactly', () => {
    const r = calculatePlates(62.5);
    expect(r.perSide).toEqual([
      { plateKg: 20, count: 1 },
      { plateKg: 1.25, count: 1 },
    ]);
    expect(r.loadedKg).toBe(62.5);
  });
  it('uses multiple heavy plates', () => {
    const r = calculatePlates(200);
    expect(r.perSide).toEqual([
      { plateKg: 25, count: 3 },
      { plateKg: 15, count: 1 },
    ]);
  });
  it('reports a remainder when the target cannot be loaded', () => {
    const r = calculatePlates(61);
    expect(r.loadedKg).toBe(60);
    expect(r.remainderKg).toBe(1);
  });
  it('returns just the bar for targets at or below it', () => {
    expect(calculatePlates(20).perSide).toEqual([]);
    const low = calculatePlates(15);
    expect(low.loadedKg).toBe(20);
    expect(low.remainderKg).toBe(-5);
  });
  it('supports a custom bar and plate set', () => {
    const r = calculatePlates(35, { barKg: 15, platesKg: [5, 10] });
    expect(r.perSide).toEqual([{ plateKg: 10, count: 1 }]);
    expect(r.loadedKg).toBe(35);
  });
});
