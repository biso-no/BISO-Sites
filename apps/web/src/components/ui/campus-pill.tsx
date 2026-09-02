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
import { useScopedCampusId } from "@/components/context/use-scoped-campus";
import { campusSwitchHref } from "@/lib/campus-scope";

/**
 * Campus as a labelled place, not a filter buried in a row of icons.
 *
 * The chosen design names the campus three times above the fold — in the logo
 * lockup, in this pill, and in the hero — because campus is the site's primary
 * dimension, not a preference. This is the header half of that.
 *
 * **This control does one job: it filters.** Pick a campus and the page you are
 * on narrows to it — the whole site does, as you move through it. It does not
 * navigate anywhere. An earlier version made every option a link to
 * `/campus/<slug>`, which turned the site's primary filter into a menu of
 * destinations: choosing Bergen from `/events` answered "show me Bergen" by
 * leaving the events feed. The way to a campus's own page is the Campus column
 * of the "For students" panel, which leads with the active one.
 *
 * Each option is still a real `<Link>`, because the filter belongs in the URL:
 * `/events?campus=bergen` is shareable, back undoes the switch, and a crawler
 * sees a distinct page (canonicalled to the unscoped listing). Selecting also
 * writes the cookie via `selectCampus`, so the choice carries to pages the URL
 * cannot describe.
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

/**
 * The URL is authoritative for what the page shows, and `SiteShell` — a layout
 * — can see neither half of it. `useScopedCampusId` resolves it the way the
 * routes do; the pathname and query are also what `campusSwitchHref` needs to
 * rewrite the current URL in place.
 */
function CampusPillWithUrlScope({ className }: { className?: string }) {
  const campusId = useScopedCampusId();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  return (
    <CampusPillView
      campusId={campusId}
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
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "type-body-sm inline-flex items-center gap-2 rounded-biso-pill border border-edge px-3 py-1.5 text-ink transition-colors",
          "hover:border-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
          className
        )}
      >
        <MapPin aria-hidden="true" className="size-4 text-ink-accent" />
        <span className="sr-only">{t("filterByCampus")}: </span>
        {label}
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
