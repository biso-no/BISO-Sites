"use client";

import type { Campus } from "@repo/api/types/appwrite";
import { MapPin } from "lucide-react";
import Link from "next/link";
import { useCampus } from "@/components/context/campus";
import { campusLandingHref } from "@/lib/campus-scope";

interface CampusLinkProps {
  campus: Campus;
  onNavigate: () => void;
}

/**
 * A campus in the "For students" mega-panel.
 *
 * It goes to *that* campus's page. It used to `router.push("/campus")` — the
 * index — for every entry, so clicking "Bergen" landed on a list of all five
 * campuses with Bergen no more prominent than the rest. A real `<Link>` also
 * restores prefetch, middle-click and open-in-new-tab, which the button
 * silently removed. Selecting still persists the choice, so the rest of the
 * site follows.
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
