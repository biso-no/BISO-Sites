"use client";

import type { Campus } from "@repo/api/types/appwrite";
import { ArrowRight, MapPin } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { useCampus } from "@/components/context/campus";
import { useScopedCampusId } from "@/components/context/use-scoped-campus";
import { campusLandingHref } from "@/lib/campus-scope";

interface CampusLinkProps {
  campus: Campus;
  onNavigate: () => void;
}

/**
 * One campus in the "For students" mega-panel.
 *
 * It goes to *that* campus's page. Every entry used to `router.push("/campus")`
 * — the index — so clicking "Bergen" landed on a list of all five with Bergen
 * no more prominent than the rest. A real `<Link>` also restores prefetch,
 * middle-click and open-in-new-tab, which the button silently removed.
 *
 * Selecting still persists the choice, so the rest of the site follows the
 * campus whose page you just opened.
 */
export function CampusLink({ campus, onNavigate }: CampusLinkProps) {
  const { selectCampus } = useCampus();

  return (
    <Link
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-white/80 transition-colors hover:bg-brand-muted hover:text-brand"
      href={campusLandingHref(campus.$id)}
      onClick={() => {
        selectCampus(campus.$id, { refresh: false });
        onNavigate();
      }}
    >
      <MapPin aria-hidden className="h-4 w-4 shrink-0 opacity-80" />
      {campus.name}
    </Link>
  );
}

/**
 * The way to the **active** campus's page.
 *
 * The campus control in the header is a filter and nothing else — it never
 * navigates — so this is where "take me to my campus" lives. It leads the
 * Campus column, above the list of all five, and falls back to the campus
 * overview when no campus is selected rather than guessing one.
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
      className="mb-1 flex w-full items-center justify-between gap-2 rounded-md border border-brand-border px-2 py-2 text-left font-semibold text-brand text-sm transition-colors hover:bg-brand-muted"
      href={campusLandingHref(resolved)}
      onClick={onNavigate}
    >
      <span className="flex items-center gap-2">
        <MapPin aria-hidden className="h-4 w-4 shrink-0" />
        {label}
      </span>
      <ArrowRight aria-hidden className="h-4 w-4 shrink-0 opacity-80" />
    </Link>
  );
}
