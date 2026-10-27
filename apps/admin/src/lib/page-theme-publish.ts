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

/**
 * Whether `theme`, sent with a save of a department page, is what the
 * department already has (`columns`): the same pair after hex normalising,
 * or a reset (`null`) while the department uses BISO's colours. Such a theme
 * is dropped from the save: a second tab opened before a publish moved the
 * theme to the department would otherwise put it back on the page, and a
 * later publish of that page would copy it over whatever the department has
 * by then. An absent theme never matches; there is nothing to drop.
 */
export function isDepartmentTheme(
  theme: PageMeta["theme"],
  columns: Partial<DepartmentThemeColumns>
): boolean {
  if (theme === undefined) {
    return false;
  }
  const current = parsePageTheme({
    accent: columns.theme_accent,
    dark: columns.theme_dark,
  });
  if (theme === null || current === null) {
    return theme === current;
  }
  const sent = parsePageTheme(theme);
  if (!sent) {
    return false;
  }
  const dark = normalizeHex(sent.dark);
  const accent = normalizeHex(sent.accent);
  return (
    dark !== null &&
    accent !== null &&
    dark === normalizeHex(current.dark) &&
    accent === normalizeHex(current.accent)
  );
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
