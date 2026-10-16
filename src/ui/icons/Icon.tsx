import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { useTheme } from '../ThemeProvider';
import { FILLABLE, GLYPHS, type IconName, type Shape } from './glyphs';

export interface IconProps {
  name: IconName;
  /** Pixel size (default 24; mockups use 18–22 inside controls). */
  size?: number;
  /** Defaults to text1. Pass a theme colour, never a literal hex. */
  color?: string;
  /** Solid version (active tab, earned). Glyphs without one get a heavier stroke. */
  filled?: boolean;
  /** Stroke width on the 24 grid (default 2; check marks on accent use 3). */
  strokeWidth?: number;
  testID?: string;
}

/**
 * Decorative by default: give the surrounding control the accessibility label
 * (IconButton requires one).
 */
export function Icon({ name, size = 24, color, filled = false, strokeWidth = 2, testID }: IconProps) {
  const { colors } = useTheme();
  const tint = color ?? colors.text1;
  const solid = filled && FILLABLE.has(name);
  const sw = filled && !solid ? Math.max(strokeWidth, 2.4) : strokeWidth;
  const shapes: readonly Shape[] = GLYPHS[name];

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {shapes.map((s, i) => {
        const fill = s.fill === true || (solid && !(s.kind === 'path' && s.line === true)) ? tint : 'none';
        const common = {
          stroke: s.fill === true ? 'none' : tint,
          strokeWidth: sw,
          strokeLinecap: 'round' as const,
          strokeLinejoin: 'round' as const,
          fill,
        };
        switch (s.kind) {
          case 'path':
            return <Path key={i} d={s.d} {...common} />;
          case 'circle':
            return <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} {...common} />;
          case 'rect':
            return <Rect key={i} x={s.x} y={s.y} width={s.width} height={s.height} rx={s.rx} {...common} />;
        }
      })}
    </Svg>
  );
}
