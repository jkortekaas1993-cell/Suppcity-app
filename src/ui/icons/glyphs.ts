/**
 * Supp City icon set: own SVG glyphs on a 24×24 grid, 2px round stroke (matches the mockups).
 * Add a glyph here, never pull in an icon library.
 *
 * `fill: true` on a shape means it is always solid (dots, play triangle).
 * Glyphs in FILLABLE get a solid version when `filled` is set (active tab, earned star);
 * `line: true` keeps a sub-path as a stroke in that solid version (bag handle, award ribbon).
 */
export type Shape =
  | { kind: 'path'; d: string; fill?: boolean; line?: boolean }
  | { kind: 'circle'; cx: number; cy: number; r: number; fill?: boolean }
  | { kind: 'rect'; x: number; y: number; width: number; height: number; rx?: number; fill?: boolean };

const p = (d: string, fill?: boolean): Shape => ({ kind: 'path', d, fill });
const l = (d: string): Shape => ({ kind: 'path', d, line: true });
const c = (cx: number, cy: number, r: number, fill?: boolean): Shape => ({ kind: 'circle', cx, cy, r, fill });
const r = (x: number, y: number, width: number, height: number, rx?: number): Shape => ({
  kind: 'rect',
  x,
  y,
  width,
  height,
  rx,
});

export const GLYPHS = {
  home: [p('M3 11 12 4l9 7v9h-6v-6H9v6H3z')],
  dumbbell: [p('M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11')],
  nutrition: [c(12, 12, 8), p('M12 4v8l6 4')],
  bag: [p('M5 8h14l-1 12H6z'), l('M9 8a3 3 0 0 1 6 0')],
  user: [c(12, 8, 4), p('M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6')],
  play: [p('M7 4.5v15l12-7.5z', true)],
  check: [p('m5 12 5 5 9-10')],
  'chevron-left': [p('m15 6-6 6 6 6')],
  'chevron-right': [p('m9 6 6 6-6 6')],
  'chevron-down': [p('m6 9 6 6 6-6')],
  'chevron-up': [p('m6 15 6-6 6 6')],
  more: [c(5, 12, 1.8, true), c(12, 12, 1.8, true), c(19, 12, 1.8, true)],
  plus: [p('M12 5v14M5 12h14')],
  minus: [p('M5 12h14')],
  search: [c(11, 11, 6), p('m20 20-4.5-4.5')],
  scan: [p('M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M8 9v6M12 9v6M16 9v6')],
  settings: [c(12, 12, 3), p('M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1')],
  star: [p('M12 2.5 14.9 8.6 21.5 9.3 16.6 13.8 18 20.4 12 17 6 20.4 7.4 13.8 2.5 9.3 9.1 8.6z')],
  trophy: [p('M8 4h8v6a4 4 0 0 1-8 0zM16 6h3v1a3 3 0 0 1-3 3M8 6H5v1a3 3 0 0 0 3 3M12 14v4M8 20h8')],
  award: [c(12, 9, 6), l('m8.5 14-1.5 8 5-3 5 3-1.5-8')],
  calendar: [r(4, 5, 16, 15, 2), p('M4 10h16M9 3v4M15 3v4')],
  pill: [r(3, 8, 18, 8, 4), p('M12 8v8')],
  share: [p('M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5')],
  'trend-up': [p('M7 17 17 7M9 7h8v8')],
  close: [p('M6 6l12 12M18 6 6 18')],
  timer: [c(12, 13, 8), p('M12 9v4l2.5 2.5M9 2h6M12 2v3')],
  info: [c(12, 12, 9), p('M12 11v6M12 7.5v.01')],
  trash: [p('M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3')],
} as const satisfies Record<string, readonly Shape[]>;

export type IconName = keyof typeof GLYPHS;

/** Glyphs with a meaningful solid version (filled interior). Others thicken the stroke instead. */
export const FILLABLE: ReadonlySet<IconName> = new Set<IconName>(['home', 'bag', 'user', 'star', 'award']);

export const ICON_NAMES = Object.keys(GLYPHS) as IconName[];
