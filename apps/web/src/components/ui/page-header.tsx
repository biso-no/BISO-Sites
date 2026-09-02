import { cn } from "@repo/ui/lib/utils";
import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronFrame } from "./chevron-frame";
import { Section } from "./section";

/**
 * The navy band at the top of every page: breadcrumb, display title, lede.
 *
 * Replaces `about/about-hero` (15 usages — the most-reused component in the
 * app), `public/public-page-header` (3), and eight per-feature heroes that each
 * re-implemented the same idea with different spacing and type.
 *
 * The display title **is** the page's `<h1>`. Phase 0 could not settle `<h1>`
 * coverage statically because headings were composed through hero components;
 * routing every page through this one makes the answer structural.
 */
export interface Crumb {
  href?: string;
  label: string;
}

export interface PageHeaderProps {
  actions?: ReactNode;
  breadcrumbs?: Crumb[];
  className?: string;
  /** Small uppercase label above the title, e.g. a campus or section name. */
  eyebrow?: string;
  lede?: string;
  /** Optional media, shown in the chevron frame on wide viewports. */
  media?: ReactNode;
  /**
   * Status pills sitting between the title and the lede — the facts that
   * qualify the title (employment type, paid, sold out, date). Separate from
   * `actions` because these are read, not clicked.
   */
  meta?: ReactNode;
  title: string;
}

export function PageHeader({
  title,
  eyebrow,
  lede,
  breadcrumbs,
  media,
  meta,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <Section
      as="header"
      // In light mode the navy band ends where the white content begins, and
      // the colour change draws the boundary. In dark mode (RD-005: the page
      // is navy throughout and cards lift rather than invert) both are the
      // same navy, so band and content merged into one field. The hairline
      // draws it there, and is invisible against the light-mode contrast.
      className={cn("relative overflow-hidden border-edge border-b", className)}
      clearNav
      tone="deep"
    >
      <div className={cn("grid gap-8", media && "lg:grid-cols-[1fr_auto]")}>
        <div>
          {breadcrumbs && breadcrumbs.length > 0 ? (
            <nav aria-label="Breadcrumb" className="mb-4">
              <ol className="type-body-sm flex flex-wrap items-center gap-x-2 gap-y-1 text-ink-muted">
                {breadcrumbs.map((crumb, i) => {
                  const isLast = i === breadcrumbs.length - 1;
                  return (
                    <li className="flex items-center gap-2" key={crumb.label}>
                      {i > 0 && (
                        <span aria-hidden="true" className="opacity-50">
                          /
                        </span>
                      )}
                      {crumb.href && !isLast ? (
                        <Link
                          className="underline-offset-4 hover:text-ink hover:underline focus-visible:rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                          href={crumb.href}
                        >
                          {crumb.label}
                        </Link>
                      ) : (
                        <span aria-current={isLast ? "page" : undefined}>
                          {crumb.label}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            </nav>
          ) : null}

          {eyebrow ? (
            <p className="type-label mb-3 text-ink-accent">{eyebrow}</p>
          ) : null}

          <h1 className="type-display-lg max-w-[18ch] text-ink">{title}</h1>

          {meta ? (
            <div className="mt-5 flex flex-wrap items-center gap-2">{meta}</div>
          ) : null}

          {lede ? (
            <p className="type-body mt-5 max-w-(--measure) text-ink-muted">
              {lede}
            </p>
          ) : null}

          {actions ? (
            <div className="mt-7 flex flex-wrap gap-3">{actions}</div>
          ) : null}
        </div>

        {media ? (
          <div className="hidden lg:block lg:w-[22rem]">
            <ChevronFrame ratio="4/3">{media}</ChevronFrame>
          </div>
        ) : null}
      </div>
    </Section>
  );
}
