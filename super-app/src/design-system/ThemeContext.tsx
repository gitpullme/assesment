import React, { createContext, useContext, useState, ReactNode } from 'react';
import { ThemeColors, darkThemeColors, lightThemeColors, spacing, borderRadius, typography } from './tokens';

export type ThemeMode = 'dark' | 'light';

export interface ThemeContextValue {
  readonly mode: ThemeMode;
  readonly colors: ThemeColors;
  readonly spacing: typeof spacing;
  readonly borderRadius: typeof borderRadius;
  readonly typography: typeof typography;
  readonly toggleTheme: () => void;
  readonly setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [mode, setMode] = useState<ThemeMode>('dark');

  const toggleTheme = (): void => {
    setMode((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const colors = mode === 'dark' ? darkThemeColors : lightThemeColors;

  const value: ThemeContextValue = {
    mode,
    colors,
    spacing,
    borderRadius,
    typography,
    toggleTheme,
    setThemeMode: setMode,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
