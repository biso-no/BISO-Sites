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
import { useTranslations } from "next-intl";
import { useCampus } from "@/components/context/campus";
import { campusIdToSlug } from "@/lib/campus-scope";

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
  const { campuses, activeCampusId, selectCampus } = useCampus();
  const t = useTranslations("common.navigation");

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
