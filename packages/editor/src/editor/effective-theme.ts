import {
  checkTheme,
  isBisoTheme,
  normalizeHex,
  type PageTheme,
  themeTokens,
} from "@repo/shared/utils/page-theme";
import type { EditorDepartment, PageMeta } from "./types";

/**
 * The theme the page will render with: its own when set (`null` resets to
 * BISO), otherwise its department's, otherwise none.
 */
export function effectiveTheme(
  meta: PageMeta,
  departments: EditorDepartment[]
): PageTheme | null {
  if (meta.theme !== undefined) {
    return meta.theme;
  }
  return departments.find((d) => d.id === meta.department)?.theme ?? null;
}

/** True when the page has its own theme and it fails the contrast check. */
export function themeBlocksSave(meta: PageMeta): boolean {
  const { theme } = meta;
  if (typeof theme !== "object" || theme === null) {
    return false;
  }
  return !checkTheme(theme).ok;
}

/**
 * Inline custom properties for the canvas frame. BISO's own colours and
 * anything that is not valid hex give none. A valid theme that fails contrast
 * still paints, so the editor sees the colours while they fix them.
 */
export function canvasThemeStyle(
  theme: PageTheme | null
): Record<`--${string}`, string> | undefined {
  if (!theme || isBisoTheme(theme)) {
    return;
  }
  if (!(normalizeHex(theme.dark) && normalizeHex(theme.accent))) {
    return;
  }
  return themeTokens(theme);
}

/** Why Publish is unavailable while the theme blocks saving. */
export const THEME_BLOCKS_PUBLISH =
  "The page colours fail the contrast check. Fix them in Page settings to publish.";

/**
 * Wraps a publish handler so it rejects, without publishing, while the theme
 * blocks saving. Rejecting keeps the host contract: the shell mirrors a
 * resolved publish into the page's status.
 */
export function guardPublish<T extends unknown[], R>(
  publish: ((...args: T) => Promise<R>) | undefined,
  getMeta: () => PageMeta
): ((...args: T) => Promise<R>) | undefined {
  if (!publish) {
    return;
  }
  return (...args: T) => {
    if (themeBlocksSave(getMeta())) {
      return Promise.reject(new Error(THEME_BLOCKS_PUBLISH));
    }
    return publish(...args);
  };
}
