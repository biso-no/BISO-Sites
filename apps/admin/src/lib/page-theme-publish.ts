import type { PageMeta } from "@repo/editor/types";
import {
  checkTheme,
  normalizeHex,
  parsePageTheme,
} from "@repo/shared/utils/page-theme";

export interface DepartmentThemeColumns {
  theme_accent: string | null;
  theme_dark: string | null;
}

/**
 * What publishing a page does to its department's theme columns.
 * `theme` absent: the page never touched the theme, so leave the department
 * alone ("skip"). `null`: reset to BISO. A passing pair: copy it. Anything
 * failing contrast or malformed: "invalid" (the caller must not write it).
 */
export function departmentThemeUpdate(
  meta: Pick<PageMeta, "theme">
): DepartmentThemeColumns | "invalid" | "skip" {
  const { theme } = meta;
  if (theme === undefined) {
    return "skip";
  }
  if (theme === null) {
    return { theme_accent: null, theme_dark: null };
  }
  const parsed = parsePageTheme(theme);
  if (!(parsed && checkTheme(parsed).ok)) {
    return "invalid";
  }
  const dark = normalizeHex(parsed.dark);
  const accent = normalizeHex(parsed.accent);
  if (!(dark && accent)) {
    return "invalid";
  }
  return { theme_accent: accent, theme_dark: dark };
}

export const THEME_CONTRAST_ERROR =
  "The page colours do not have enough colour contrast. Pick a darker main colour or a lighter accent, or use the suggested shades.";

/** A save error sentence when the submitted theme is unusable, else null. */
export function themeSaveError(meta: Pick<PageMeta, "theme">): string | null {
  const { theme } = meta;
  if (theme === undefined || theme === null) {
    return null;
  }
  return departmentThemeUpdate({ theme }) === "invalid"
    ? THEME_CONTRAST_ERROR
    : null;
}
