import { type PageTheme, themeCss } from "@repo/shared/utils/page-theme";
import { PageThemeStyleClient } from "./page-theme-style-client";

/**
 * Overrides the navy-derived tokens for the page that renders it.
 *
 * Render it as the first element of a page's own tree, never in a layout:
 * a plain `<style>` (no `href`, no `precedence`) is removed with the page, and
 * the client element switches itself off while Next keeps the page hidden. `theme` must come from `resolvePageTheme`,
 * which has already validated it.
 */
export function PageThemeStyle({ theme }: { theme: PageTheme | null }) {
  if (!theme) {
    return null;
  }
  return <PageThemeStyleClient css={themeCss(theme)} />;
}
