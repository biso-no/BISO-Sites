import "server-only";
import {
  isBisoTheme,
  type PageTheme,
  parsePageTheme,
} from "@repo/shared/utils/page-theme";

interface DepartmentThemeColumns {
  theme_accent: string | null;
  theme_dark: string | null;
}

/**
 * The theme a public page wears, or null for BISO's own colours.
 *
 * A page bound to a department (`departmentId` set, or `departmentTheme`
 * given) takes that department's theme, even when the department has none or
 * its row is missing: the page then renders BISO rather than its own stale doc
 * theme (C1). An unbound page uses the theme in its document's meta.
 *
 * Every candidate goes through `parsePageTheme` first, so a hostile string or
 * a pair that fails contrast comes out as null. BISO's own pair is also null:
 * BISO pages stay byte-identical, since a derived blue would differ from the
 * hand-tuned one.
 */
export function resolvePageTheme({
  departmentId,
  departmentTheme,
  docTheme,
}: {
  /** The page's `department_id`; set means bound, even if the row is gone. */
  departmentId?: string | null;
  /** The bound department's columns; null when its row is missing. */
  departmentTheme: DepartmentThemeColumns | null | undefined;
  docTheme: PageTheme | null | undefined;
}): PageTheme | null {
  const bound = Boolean(departmentId) || Boolean(departmentTheme);
  let candidate: unknown = docTheme;
  if (bound) {
    candidate = departmentTheme
      ? {
          dark: departmentTheme.theme_dark,
          accent: departmentTheme.theme_accent,
        }
      : null;
  }
  const theme = parsePageTheme(candidate);
  return theme && !isBisoTheme(theme) ? theme : null;
}
