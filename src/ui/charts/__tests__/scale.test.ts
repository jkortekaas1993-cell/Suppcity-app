import { areaPath, linePath, niceDomain, niceStep, toPoints, yFor } from '../scale';

describe('chart scale', () => {
  it('picks 1/2/2.5/5 × 10^n steps', () => {
    expect(niceStep(20, 2)).toBe(10);
    expect(niceStep(14, 2)).toBe(10);
    expect(niceStep(3, 3)).toBe(1);
    expect(niceStep(0.9, 2)).toBe(0.5);
    expect(niceStep(0, 2)).toBe(1);
  });

  it('snaps the domain outward to nice ticks (Voortgang mockup: 94…108 → 90/100/110)', () => {
    const d = niceDomain([94, 96, 95, 99, 101, 102, 104, 106, 108], 2);
    expect(d.min).toBe(90);
    expect(d.max).toBe(110);
    expect(d.ticks).toEqual([90, 100, 110]);
  });

  it('handles empty and flat series', () => {
    expect(niceDomain([])).toEqual({ min: 0, max: 1, ticks: [0, 1] });
    const flat = niceDomain([50, 50, 50]);
    expect(flat.min).toBeLessThan(50);
    expect(flat.max).toBeGreaterThan(50);
    expect(niceDomain([NaN, 10]).ticks.length).toBeGreaterThan(1);
  });

  it('maps values to pixels and builds paths', () => {
    const frame = { width: 110, height: 60, left: 5, right: 5, top: 10, bottom: 10 };
    const domain = { min: 0, max: 10, ticks: [0, 5, 10] };
    const pts = toPoints([0, 10], domain, frame);
    expect(pts).toEqual([
      { x: 5, y: 50 },
      { x: 105, y: 10 },
    ]);
    expect(yFor(5, domain, frame)).toBe(30);
    expect(linePath(pts)).toBe('M5 50 L105 10');
    expect(areaPath(pts, 50)).toBe('M5 50 L105 10 L105 50 L5 50 Z');
    expect(areaPath([], 50)).toBe('');
    expect(toPoints([3], domain, frame)[0]?.x).toBe(55);
  });
});
