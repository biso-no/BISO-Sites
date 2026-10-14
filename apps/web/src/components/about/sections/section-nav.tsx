"use client";

import { useTranslations } from "next-intl";
import { ABOUT_SECTIONS } from "@/lib/about-sections";

/** Sticky jump menu for the merged page. */
export function AboutSectionNav() {
  const t = useTranslations("about.sections");
  return (
    <nav
      aria-label={t("navLabel")}
      className="sticky top-16 z-20 border-border/60 border-b bg-background/90 backdrop-blur"
    >
      <ul className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-2 text-sm sm:px-6 lg:px-8">
        {ABOUT_SECTIONS.map((section) => (
          <li className="shrink-0" key={section.id}>
            <a
              className="block rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:bg-brand-muted hover:text-brand-dark"
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
