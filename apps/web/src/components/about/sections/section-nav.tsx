import { getTranslations } from "next-intl/server";
import { ABOUT_SECTIONS } from "@/lib/about-sections";

/**
 * The merged page's section menu, as the content template's "On this page"
 * rail (spec §4.5).
 *
 * From `lg` it is a sticky column beside the sections. Below that it is a
 * horizontal strip that sticks under the fixed header, so the menu is never
 * more than a glance away on a long page — what the Branding Committee asked
 * for. The strip scrolls inside itself rather than widening the page at 320px.
 *
 * Server-rendered anchors: following one needs no JavaScript, and the order is
 * `ABOUT_SECTIONS`, the same list the redirects of the retired subpages use.
 */
export async function AboutSectionNav() {
  const [t, tLabels] = await Promise.all([
    getTranslations("about.sections"),
    getTranslations("common.labels"),
  ]);

  return (
    <nav
      aria-label={t("navLabel")}
      className="sticky top-20 z-20 -mx-4 mb-8 min-w-0 border-edge border-b bg-surface px-4 py-3 sm:-mx-6 sm:px-6 lg:top-28 lg:mx-0 lg:mb-0 lg:self-start lg:border-b-0 lg:bg-transparent lg:p-0"
    >
      <p className="type-label mb-3 hidden text-ink-muted lg:block">
        {tLabels("onThisPage")}
      </p>
      <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-0 lg:overflow-visible lg:border-edge lg:border-s">
        {ABOUT_SECTIONS.map((section) => (
          <li className="shrink-0" key={section.id}>
            <a
              className="type-body-sm block whitespace-nowrap rounded-biso-pill px-3 py-1.5 text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface lg:-ms-px lg:whitespace-normal lg:rounded-none lg:border-transparent lg:border-s-2 lg:py-2 lg:ps-4 lg:hover:border-ink-accent lg:hover:bg-transparent"
              href={`#${section.id}`}
            >
              {t(section.labelKey)}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
