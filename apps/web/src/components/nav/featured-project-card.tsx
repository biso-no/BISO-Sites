"use client";

import { ImageWithFallback } from "@repo/ui/components/image";
import { Card } from "@repo/ui/components/ui/card";
import { PLACEHOLDER_IMAGE } from "@repo/ui/lib/placeholder-images";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { NavFeaturedItem } from "@/lib/types/nav";

interface FeaturedProjectCardProps {
  onNavigate: () => void;
  project: NavFeaturedItem;
}

export function FeaturedProjectCard({
  project,
  onNavigate,
}: FeaturedProjectCardProps) {
  const t = useTranslations("common.navigation");

  return (
    <Link href={`/projects/${project.slug}`} onClick={onNavigate}>
      <Card className="group overflow-hidden border-brand-border bg-brand-muted/40 transition-colors hover:border-brand">
        <div className="relative aspect-[16/9] w-full overflow-hidden">
          <ImageWithFallback
            alt={project.title}
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            fill
            sizes="320px"
            src={project.image || PLACEHOLDER_IMAGE}
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/10 to-transparent" />
        </div>
        <div className="space-y-1 p-4">
          <span className="font-semibold text-[11px] text-brand uppercase tracking-wide">
            {t("featured.projectLabel")}
          </span>
          <h4 className="flex items-center gap-1.5 font-semibold text-sm text-white">
            {project.title}
            <ArrowRight
              aria-hidden
              className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1"
            />
          </h4>
        </div>
      </Card>
    </Link>
  );
}
