"use client";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type * as React from "react";

export type ThemeProviderProps = {
  children: React.ReactNode;
  /** Default theme, e.g. 'system' | 'light' | 'dark' */
  defaultTheme?: string;
  /** Enable system preference detection */
  enableSystem?: boolean;
  /** Storage key for theme */
  storageKey?: string;
};

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
      disableTransitionOnChange
      enableSystem={enableSystem}
      storageKey={storageKey}
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
