/** Pure chart math (no React), unit-tested in __tests__/scale.test.ts. */

export interface Domain {
  min: number;
  max: number;
  /** Tick values from min to max (inclusive), evenly spaced on a "nice" step. */
  ticks: number[];
}

/** A step of 1, 2, 2.5 or 5 × 10^n that gives roughly `count` intervals over `span`. */
export function niceStep(span: number, count: number): number {
  if (!(span > 0) || !(count > 0)) return 1;
  const raw = span / count;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / pow;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * pow;
}

/**
 * Y domain that contains all values, snapped outward to nice ticks (about `count` intervals).
 * A flat series gets a small band around its value so the line sits in the middle.
 */
export function niceDomain(values: readonly number[], count = 2): Domain {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return { min: 0, max: 1, ticks: [0, 1] };
  let lo = Math.min(...finite);
  let hi = Math.max(...finite);
  if (lo === hi) {
    const pad = Math.abs(lo) > 0 ? Math.abs(lo) * 0.1 : 1;
    lo -= pad;
    hi += pad;
  }
  const step = niceStep(hi - lo, count);
  const min = Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let t = min; t <= max + step / 2; t += step) ticks.push(Number(t.toFixed(10)));
  return { min, max, ticks };
}

export interface Point {
  x: number;
  y: number;
}

export interface Frame {
  width: number;
  height: number;
  /** Padding inside the svg: left/right/top/bottom of the plot area. */
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Map series values to pixel points in the plot area (index on x, value on y). */
export function toPoints(values: readonly number[], domain: Domain, frame: Frame): Point[] {
  const w = Math.max(0, frame.width - frame.left - frame.right);
  const h = Math.max(0, frame.height - frame.top - frame.bottom);
  const span = domain.max - domain.min || 1;
  const n = values.length;
  return values.map((v, i) => ({
    x: frame.left + (n <= 1 ? w / 2 : (i / (n - 1)) * w),
    y: frame.top + (1 - (v - domain.min) / span) * h,
  }));
}

/** Map a value to its y pixel (for grid lines). */
export function yFor(value: number, domain: Domain, frame: Frame): number {
  const h = Math.max(0, frame.height - frame.top - frame.bottom);
  const span = domain.max - domain.min || 1;
  return frame.top + (1 - (value - domain.min) / span) * h;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Straight-segment line path "M x y L x y …". Empty string for no points. */
export function linePath(points: readonly Point[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${r1(p.x)} ${r1(p.y)}`).join(' ');
}

/** Closed area under the line down to `baseY` (for the gradient fill). */
export function areaPath(points: readonly Point[], baseY: number): string {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return '';
  return `${linePath(points)} L${r1(last.x)} ${r1(baseY)} L${r1(first.x)} ${r1(baseY)} Z`;
}
