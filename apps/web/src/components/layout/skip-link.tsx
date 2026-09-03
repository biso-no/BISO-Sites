import { getTranslations } from "next-intl/server";

/** The id `SiteShell` puts on its `<main>`; the skip link's target. */
export const MAIN_CONTENT_ID = "main-content";

/**
 * The first focusable element on every page with chrome.
 *
 * The header carries a 12-item mega-menu plus a utility cluster, so without
 * this a keyboard user tabs through roughly 25 controls to reach page content —
 * on every single navigation. Phase 0 found no skip link anywhere
 * (00-current-state.md §8.2).
 *
 * Visually hidden until focused, then pinned top-left over the fixed header.
 * `(auth)` has no chrome to skip, so it does not render one.
 */
export async function SkipLink() {
  const t = await getTranslations("common");

  return (
    <a
      // Every visual style sits behind `focus:`. Padding or a background
      // alongside `sr-only` inflates its 1x1 box — `px-4 py-2` alone made this
      // a 32x16 coloured rectangle at the top of every page: unreadable, but
      // visible. Caught in RD-013 by measuring the unfocused element.
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-100 focus:rounded-biso-md focus:bg-action focus:px-4 focus:py-2 focus:text-action-ink focus:outline-none focus:ring-2 focus:ring-focus-ring focus:ring-offset-2 focus:ring-offset-surface"
      href={`#${MAIN_CONTENT_ID}`}
    >
      {t("skipToContent")}
    </a>
  );
}
