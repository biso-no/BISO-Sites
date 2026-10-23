import { type PageTheme, themeCss } from "@repo/shared/utils/page-theme";

/**
 * Overrides the navy-derived tokens for the page that renders it.
 *
 * Render it as the first element of a page's own tree, never in a layout:
 * a plain `<style>` (no `href`, no `precedence`) is removed with the page, so
 * navy returns on the next one. `theme` must come from `resolvePageTheme`,
 * which has already validated it.
 */
export function PageThemeStyle({ theme }: { theme: PageTheme | null }) {
  if (!theme) {
    return null;
  }
  return <style>{themeCss(theme)}</style>;
}
