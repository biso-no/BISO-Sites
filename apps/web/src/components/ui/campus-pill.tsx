"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { cn } from "@repo/ui/lib/utils";
import { Check, ChevronDown, MapPin } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { useCampus } from "@/components/context/campus";
import {
  campusLandingHref,
  campusSlugToId,
  campusSwitchHref,
  parseCampusParam,
} from "@/lib/campus-scope";

/**
 * Campus as a labelled place, not a filter buried in a row of icons.
 *
 * The chosen design names the campus three times above the fold — in the logo
 * lockup, in this pill, and in the hero — because campus is the site's primary
 * dimension, not a preference. This is the header half of that.
 *
 * **The control does two jobs, so it is a split button.** The named half is a
 * link to that campus's own page; the chevron half opens the filter. An earlier
 * version collapsed the two: every option was a link to `/campus/<slug>`, so
 * choosing Bergen from `/events` answered "show me Bergen" by leaving the
 * events feed entirely. Campus is meant to be a site-wide filter — pick a
 * campus and every feed narrows to it — with one deliberate way to reach the
 * campus page itself. Splitting the control is what makes both reachable
 * without adding a seventh item to a header bar that has no room for one (the
 * utilities group already runs to within 4px of the viewport edge at the
 * 1340px breakpoint).
 *
 * Selecting still writes the cookie via `selectCampus`, so the choice carries
 * to pages the URL cannot describe.
 */
export function CampusPill({ className }: { className?: string }) {
  const { activeCampusId } = useCampus();
  // `useSearchParams` makes its caller request-dependent. `SiteShell` is a
  // layout, so it renders in the prerendered shell of every route — reading the
  // query directly here would take the whole shell out of the prerender and
  // give back the FCP the redesign bought. The Suspense boundary confines that
  // to the pill: the shell still prerenders with the server-resolved campus,
  // and the URL-aware version swaps in on the client.
  return (
    <Suspense
      fallback={
        <CampusPillView campusId={activeCampusId} className={className} />
      }
    >
      <CampusPillWithUrlScope className={className} />
    </Suspense>
  );
}

/** `/campus/<slug>` — the campus landing page scopes all its content here. */
const CAMPUS_PATH = /^\/campus\/([^/]+)/;

/**
 * The URL is authoritative for what the page shows, and `SiteShell` — a layout
 * — can see neither half of it. Without this, a shared `/events?campus=bergen`
 * listed Bergen events under a pill reading "All Campuses" (or the visitor's
 * own campus), and `/campus/bergen` did the same, so the header contradicted
 * the content it sits above.
 *
 * Both the query parameter and the campus landing path are read, because both
 * scope a page independently of the cookie. The pathname and query are also
 * what `campusSwitchHref` needs to rewrite the current URL in place.
 */
function CampusPillWithUrlScope({ className }: { className?: string }) {
  const { activeCampusId } = useCampus();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const fromQuery = searchParams.get("campus");
  const fromPath = CAMPUS_PATH.exec(pathname)?.[1] ?? null;

  // Resolve `?campus=` through the same parser the routes use, rather than
  // `campusSlugToId` alone. It accepts three things this component previously
  // did not preserve: `all`, which is an authoritative "no filter" and must not
  // fall through to the cookie; a numeric campus id, which older links carry;
  // and an unrecognised value, where the page 404s so the label is moot.
  const parsed = parseCampusParam(fromQuery ?? undefined);
  let scoped: string | null = null;
  let queryIsAuthoritative = false;
  if (parsed.kind === "campus") {
    scoped = parsed.id;
    queryIsAuthoritative = true;
  } else if (parsed.kind === "all") {
    queryIsAuthoritative = true;
  } else if (fromPath) {
    scoped = campusSlugToId(fromPath);
    queryIsAuthoritative = scoped !== null;
  }

  return (
    <CampusPillView
      campusId={queryIsAuthoritative ? scoped : (scoped ?? activeCampusId)}
      className={className}
      pathname={pathname}
      search={searchParams.toString()}
    />
  );
}

function CampusPillView({
  campusId,
  className,
  pathname,
  search,
}: {
  campusId: string | null;
  className?: string;
  /** Absent in the prerendered fallback, where the URL is not yet readable. */
  pathname?: string;
  search?: string;
}) {
  const { campuses, selectCampus } = useCampus();
  const t = useTranslations("common.navigation");

  const active = campuses.find((campus) => campus.$id === campusId);
  const label = active?.name ?? t("allCampuses");

  // Null on the campus landing pages themselves and in the prerendered
  // fallback, where the option falls back to a cookie write plus a refresh.
  const hrefFor = (id: string | null) =>
    pathname === undefined
      ? null
      : campusSwitchHref(pathname, search ?? "", id);

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-biso-pill border border-edge text-ink",
        "focus-within:ring-2 focus-within:ring-focus-ring focus-within:ring-offset-2 focus-within:ring-offset-surface",
        "hover:border-ink-accent",
        className
      )}
    >
      {/* The designated way to the campus's own page. A real link, so it
          prefetches, middle-clicks and opens in a new tab. */}
      <Link
        className="type-body-sm inline-flex flex-1 items-center gap-1.5 rounded-biso-pill py-1.5 pr-1.5 pl-2.5 transition-colors hover:text-ink-accent focus-visible:outline-none"
        href={campusLandingHref(campusId)}
      >
        <MapPin aria-hidden="true" className="size-4 text-ink-accent" />
        <span className="sr-only">{t("campusPage")}: </span>
        {label}
      </Link>

      <span
        aria-hidden="true"
        className="h-4 w-px shrink-0 self-center bg-edge"
      />

      <DropdownMenu>
        {/* `self-stretch` so the target is the full height of the pill rather
            than the height of a 16px chevron plus padding — 34 x 36 on a phone
            instead of 34 x 28. */}
        <DropdownMenuTrigger
          aria-label={t("changeCampus")}
          className="inline-flex shrink-0 items-center self-stretch rounded-biso-pill px-2 py-1.5 transition-colors hover:text-ink-accent focus-visible:outline-none"
        >
          <ChevronDown aria-hidden="true" className="size-4 opacity-60" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuLabel className="type-data text-ink-muted">
            {t("filterByCampus")}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          <CampusOption
            href={hrefFor(null)}
            isActive={campusId === null}
            label={t("allCampuses")}
            onSelect={() =>
              selectCampus(null, { refresh: hrefFor(null) === null })
            }
          />

          {campuses.map((campus) => (
            <CampusOption
              href={hrefFor(campus.$id)}
              isActive={campus.$id === campusId}
              key={campus.$id}
              label={campus.name}
              onSelect={() =>
                selectCampus(campus.$id, {
                  refresh: hrefFor(campus.$id) === null,
                })
              }
            />
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/**
 * One campus in the filter.
 *
 * A link whenever the current page can express the choice in its URL, so the
 * filtered view is shareable and the back button undoes the switch. On a page
 * with no campus dimension there is nothing to link to: the option persists the
 * cookie instead, and the choice shows up on the next scoped page.
 */
function CampusOption({
  href,
  isActive,
  label,
  onSelect,
}: {
  href: string | null;
  isActive: boolean;
  label: string;
  onSelect: () => void;
}) {
  const content = (
    <>
      {label}
      {isActive && <Check aria-hidden="true" className="size-4" />}
    </>
  );
  return (
    <DropdownMenuItem asChild>
      {href ? (
        <Link
          className="w-full cursor-pointer justify-between"
          href={href}
          onClick={onSelect}
        >
          {content}
        </Link>
      ) : (
        <button
          className="w-full cursor-pointer justify-between"
          onClick={onSelect}
          type="button"
        >
          {content}
        </button>
      )}
    </DropdownMenuItem>
  );
}
