"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { NavFeatured } from "@/lib/types/nav";
import { FeaturedEventCard } from "../featured-event-card";
import { PanelColumn } from "../mega-panel";
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
      </div>

      <aside className="space-y-3">
        {featured.event && (
          <FeaturedEventCard event={featured.event} onNavigate={onNavigate} />
        )}
        {featured.news && (
          <Link
            className="block rounded-md px-2 py-1.5 transition-colors hover:bg-brand-muted"
            href={`/news/${featured.news.slug}`}
            onClick={onNavigate}
          >
            <span className="block font-semibold text-[11px] text-brand uppercase tracking-wide">
              {t("featured.newsLabel")}
            </span>
            <span className="line-clamp-2 text-sm text-white/80">
              {featured.news.title}
            </span>
          </Link>
        )}
      </aside>
    </div>
  );
}
