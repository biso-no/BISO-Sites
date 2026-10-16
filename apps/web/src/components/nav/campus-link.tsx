"use client";

import { ArrowRight, MapPin } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { useCampus } from "@/components/context/campus";
import { useScopedCampusId } from "@/components/context/use-scoped-campus";
import { campusLandingHref } from "@/lib/campus-scope";

/**
 * The way to the **active** campus's page — the one campus entry the menus
 * carry.
 *
 * The campus control in the header is a filter and nothing else — it never
 * navigates — and it is the one place to *change* campus: the Branding
 * Committee had the list of every campus taken out of the "For students" panel
 * and the mobile drawer. What stays is this single link, the Campus column, so
 * "take me to my campus" still has a home. It falls back to the campus overview
 * when no campus is selected rather than guessing one.
 *
 * "Active" is resolved the same way the header resolves it and the same way the
 * routes do: **URL first, then the stored preference**. Reading only the cookie
 * meant that following a shared `/events?campus=bergen` gave a header saying
 * Bergen above a menu offering the campus overview.
 */
export function ActiveCampusLink({ onNavigate }: { onNavigate: () => void }) {
  // `useScopedCampusId` reads the query string, so it needs its own boundary —
  // the panel is mounted from the header, which renders in every route's
  // prerendered shell. The fallback is the preference-only answer, which is
  // right for every URL that does not carry a campus.
  return (
    <Suspense fallback={<ActiveCampusLinkView onNavigate={onNavigate} />}>
      <ScopedActiveCampusLink onNavigate={onNavigate} />
    </Suspense>
  );
}

function ScopedActiveCampusLink({ onNavigate }: { onNavigate: () => void }) {
  return (
    <ActiveCampusLinkView
      campusId={useScopedCampusId()}
      onNavigate={onNavigate}
    />
  );
}

function ActiveCampusLinkView({
  campusId,
  onNavigate,
}: {
  /** Omitted in the fallback, where the stored preference is all there is. */
  campusId?: string | null;
  onNavigate: () => void;
}) {
  const { activeCampusId, campuses } = useCampus();
  const t = useTranslations("common.navigation");

  const resolved = campusId === undefined ? activeCampusId : campusId;
  const campus = campuses.find((c) => c.$id === resolved);
  const label = campus
    ? t("goToCampus", { campus: campus.name })
    : t("campusOverview");

  return (
    <Link
      className="type-body-sm flex w-full items-center justify-between gap-2 rounded-biso-sm border border-edge px-3 py-2 text-left font-semibold text-ink transition-colors hover:border-ink-accent hover:text-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      href={campusLandingHref(resolved)}
      onClick={onNavigate}
    >
      <span className="flex items-center gap-2">
        <MapPin aria-hidden className="size-4 shrink-0 text-ink-accent" />
        {label}
      </span>
      <ArrowRight aria-hidden className="size-4 shrink-0" />
    </Link>
  );
}
