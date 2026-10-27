import {
  FullSearchTrigger,
  SearchTrigger,
} from "fumadocs-ui/layouts/shared/slots/search-trigger";
import { ThemeSwitch } from "fumadocs-ui/layouts/shared/slots/theme-switch";
import { AREAS } from "lib/areas";
import { navTitle } from "lib/layout.shared";
import Link from "next/link";

/**
 * The landing's top bar. It matches the docs pages' header: navy in both
 * themes, the logo and "Docs", the two areas, search and the theme switch.
 * `#site-header` shares that header's on-navy colour tokens in global.css, so
 * Fumadocs' search field and theme switch read as on-navy here too.
 */
export function SiteHeader() {
  return (
    <header className="bg-deep text-paper" data-surface="deep" id="site-header">
      {/* One 56px row; on a phone too narrow for it, the links and search
          wrap onto a second row instead of running into the title. */}
      <div className="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-1 border-b px-4 py-2 md:flex-nowrap md:gap-2 md:px-6 md:py-0">
        <div className="flex min-w-max flex-1 items-center">
          <Link className="inline-flex items-center gap-2.5" href="/">
            {navTitle}
          </Link>
        </div>
        <FullSearchTrigger className="my-auto w-full max-w-sm rounded-xl ps-2.5 max-md:hidden" />
        <div className="flex flex-1 items-center justify-end gap-4 md:gap-2">
          <nav aria-label="Documentation areas">
            <ul className="flex items-center gap-4 text-[13px] md:gap-6 md:text-sm">
              {AREAS.map((area) => (
                <li key={area.id}>
                  <Link
                    className="whitespace-nowrap text-ink-muted transition-colors hover:text-paper"
                    href={area.href}
                  >
                    {area.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <SearchTrigger className="-me-1.5 p-2 md:hidden" />
          <ThemeSwitch className="ms-4 max-md:hidden" />
        </div>
      </div>
    </header>
  );
}
