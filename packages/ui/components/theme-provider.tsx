"use client";
import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export interface ThemeProviderProps {
  children: React.ReactNode;
  /** Default theme, e.g. 'system' | 'light' | 'dark' */
  defaultTheme?: string;
  /** Enable system preference detection */
  enableSystem?: boolean;
  /** Storage key for theme */
  storageKey?: string;
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  enableSystem = true,
  storageKey = "theme",
  ...props
}: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={defaultTheme}
      enableSystem={enableSystem}
      storageKey={storageKey}
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}

