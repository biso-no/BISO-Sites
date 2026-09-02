"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  campusIdToSlug,
  campusSlugToId,
  parseCampusParam,
} from "@/lib/campus-scope";

/**
 * Campus as a labelled place, not a filter buried in a row of icons.
 *
 * The chosen design names the campus three times above the fold — in the logo
 * lockup, in this pill, and in the hero — because campus is the site's primary
 * dimension, not a preference. This is the header half of that.
 *
 * Each option is a **link** to `/campus/<slug>`, so switching campus produces a
 * URL someone can share. The old switcher only mutated a cookie: it changed
 * what you saw but not where you were, so a campus view could never be sent to
 * anyone. Selecting still writes the cookie too, via `selectCampus`, so the
 * choice persists across the rest of the site.
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

/** `/campus/<slug>` — the landing page scopes all of its content from this. */
const CAMPUS_PATH = /^\/campus\/([^/]+)/;

/**
 * The URL is authoritative for what the page shows, and `SiteShell` — a layout
 * — can see neither half of it. Without this, a shared `/events?campus=bergen`
 * listed Bergen events under a pill reading "All Campuses" (or the visitor's
 * own campus), and `/campus/bergen` did the same, so the header contradicted
 * the content it sits above.
 *
 * Both the query parameter and the campus landing path are read, because both
 * scope a page independently of the cookie.
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

  // `resolveRequestCampus` gives `?campus=` precedence over the cookie, so
  // clearing the cookie alone leaves the page exactly as it was — picking "All
  // campuses" on `/events?campus=bergen` looked like a dead control. The item
  // becomes a link that drops the parameter whenever one is present.
  let clearHref: string | undefined;
  if (fromQuery) {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("campus");
    const query = next.toString();
    clearHref = query ? `${pathname}?${query}` : pathname;
  }

  return (
    <CampusPillView
      campusId={queryIsAuthoritative ? scoped : (scoped ?? activeCampusId)}
      className={className}
      clearHref={clearHref}
    />
  );
}

function CampusPillView({
  campusId,
  className,
  clearHref,
}: {
  campusId: string | null;
  className?: string;
  /** Present only when the current URL carries a `?campus=` to drop. */
  clearHref?: string;
}) {
  const { campuses, selectCampus } = useCampus();
  const t = useTranslations("common.navigation");

  const activeCampusId = campusId;
  const active = campuses.find((campus) => campus.$id === activeCampusId);
  const label = active?.name ?? t("allCampuses");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "type-body-sm inline-flex items-center gap-2 rounded-biso-pill border border-edge px-3 py-1.5 text-ink transition-colors",
          "hover:border-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
          className
        )}
      >
        <MapPin aria-hidden="true" className="size-4 text-ink-accent" />
        <span className="sr-only">{t("selectCampus")}: </span>
        {label}
        <ChevronDown aria-hidden="true" className="size-4 opacity-60" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuItem asChild>
          {clearHref ? (
            <Link
              className="w-full cursor-pointer justify-between"
              href={clearHref}
              onClick={() => selectCampus(null)}
            >
              {t("allCampuses")}
              {activeCampusId === null && (
                <Check aria-hidden="true" className="size-4" />
              )}
            </Link>
          ) : (
            <button
              className="w-full cursor-pointer justify-between"
              onClick={() => selectCampus(null)}
              type="button"
            >
              {t("allCampuses")}
              {activeCampusId === null && (
                <Check aria-hidden="true" className="size-4" />
              )}
            </button>
          )}
        </DropdownMenuItem>

        {campuses.map((campus) => {
          const slug = campusIdToSlug(campus.$id);
          return (
            <DropdownMenuItem asChild key={campus.$id}>
              {/* A real link: a campus view has a URL now (RD-016). */}
              <Link
                className="cursor-pointer justify-between"
                href={slug ? `/campus/${slug}` : "/campus"}
                onClick={() => selectCampus(campus.$id)}
              >
                {campus.name}
                {campus.$id === activeCampusId && (
                  <Check aria-hidden="true" className="size-4" />
                )}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
