"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { NavFeatured } from "@/lib/types/nav";
import { ActiveCampusLink } from "../campus-link";
import { FeaturedEventCard } from "../featured-event-card";
import { PANEL_HEADING_CLASS, PanelColumn } from "../mega-panel";
import { STUDENT_COLUMNS } from "../nav-config";

interface StudentsPanelProps {
  featured: NavFeatured;
  onNavigate: () => void;
}

export function StudentsPanel({ featured, onNavigate }: StudentsPanelProps) {
  const t = useTranslations("common.navigation");

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {STUDENT_COLUMNS.map((column) => (
          <PanelColumn
            column={column}
            key={column.id}
            onNavigate={onNavigate}
          />
        ))}
        <div>
          <h3 className={PANEL_HEADING_CLASS}>{t("columns.campus")}</h3>
          {/* One link, not a list of campuses: the header's campus control is
              the one place to change campus, and it only filters. This is the
              way to a campus's own page — the one you are on. */}
          <ActiveCampusLink onNavigate={onNavigate} />
        </div>
      </div>

      <aside className="space-y-6">
        {featured.event && (
          <FeaturedEventCard event={featured.event} onNavigate={onNavigate} />
        )}
        {featured.news && (
          <Link
            className="group block rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-4 focus-visible:ring-offset-surface"
            href={`/news/${featured.news.slug}`}
            onClick={onNavigate}
          >
            <span className="type-label block text-ink-accent">
              {t("featured.newsLabel")}
            </span>
            <span className="type-body-sm mt-1 line-clamp-2 font-semibold text-ink transition-colors group-hover:text-ink-accent">
              {featured.news.title}
            </span>
          </Link>
        )}
      </aside>
    </div>
  );
}
