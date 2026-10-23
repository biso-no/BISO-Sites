"use client";

import { ImageWithFallback } from "@repo/ui/components/image";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronFrame } from "@/components/ui/chevron-frame";
import type { NavFeaturedItem } from "@/lib/types/nav";

interface FeaturedProjectCardProps {
  onNavigate: () => void;
  project: NavFeaturedItem;
}

/**
 * The featured project, in the "Projects" panel. The chevron frame is the
 * system's container for a project's identity, which is what this picture is.
 * A project without a picture is shown without a frame rather than with a
 * stock placeholder.
 */
export function FeaturedProjectCard({
  project,
  onNavigate,
}: FeaturedProjectCardProps) {
  const t = useTranslations("common.navigation");

  return (
    <Link
      className="group block rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-4 focus-visible:ring-offset-surface"
      href={`/projects/${project.slug}`}
      onClick={onNavigate}
    >
      {project.image ? (
        <ChevronFrame className="mb-3 bg-surface-sunken" ratio="16/9">
          {/* `alt=""`: the title below is the link's accessible name. */}
          <ImageWithFallback
            alt=""
            className="transition-transform duration-500 group-hover:scale-[1.03]"
            height={360}
            sizes="300px"
            src={project.image}
            width={640}
          />
        </ChevronFrame>
      ) : null}
      <span className="type-label block text-ink-accent">
        {t("featured.projectLabel")}
      </span>
      <span className="type-heading-card mt-1 flex items-center gap-1.5 text-ink transition-colors group-hover:text-ink-accent">
        {project.title}
        <ArrowRight aria-hidden className="size-4 shrink-0" />
      </span>
    </Link>
  );
}
