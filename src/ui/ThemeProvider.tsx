import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { makeTheme, type ColorScheme, type Theme } from './theme';

const ThemeContext = createContext<Theme>(makeTheme('dark'));

interface ThemeProviderProps {
  children: ReactNode;
  /** Force a scheme (tests, previews). v1 is dark only, so this defaults to 'dark'. */
  scheme?: ColorScheme;
  /** True once Barlow / Barlow Condensed are registered (app/_layout.tsx). Until then: system font. */
  fontsLoaded?: boolean;
}

export function ThemeProvider({ children, scheme = 'dark', fontsLoaded = false }: ThemeProviderProps) {
  const theme = useMemo(() => makeTheme(scheme, fontsLoaded), [scheme, fontsLoaded]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
