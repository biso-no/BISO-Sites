"use client";

import { useTranslations } from "next-intl";
import type { NavFeatured } from "@/lib/types/nav";
import { FeaturedProjectCard } from "../featured-project-card";
import { PanelLink } from "../mega-panel";
import {
  PROJECT_FLAGSHIP_ICON,
  PROJECT_FLAGSHIP_KEYS,
  PROJECT_LINKS,
} from "../nav-config";

interface ProjectsPanelProps {
  featured: NavFeatured;
  onNavigate: () => void;
}

export function ProjectsPanel({ featured, onNavigate }: ProjectsPanelProps) {
  const t = useTranslations("common.navigation");
  const tProjects = useTranslations("projects.featured");

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 font-semibold text-white/50 text-xs uppercase tracking-wider">
            {t("columns.flagships")}
          </h3>
          <ul className="space-y-0.5">
            {PROJECT_FLAGSHIP_KEYS.map((key) => (
              <li key={key}>
                <PanelLink
                  href={`/projects/${tProjects(`${key}.slug`)}`}
                  icon={PROJECT_FLAGSHIP_ICON}
                  label={tProjects(`${key}.title`)}
                  onNavigate={onNavigate}
                />
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-2 font-semibold text-white/50 text-xs uppercase tracking-wider">
            {t("events")}
          </h3>
          <ul className="space-y-0.5">
            {PROJECT_LINKS.map((link) => (
              <li key={link.id}>
                <PanelLink
                  href={link.href}
                  icon={link.icon}
                  label={t(link.labelKey)}
                  onNavigate={onNavigate}
                />
              </li>
            ))}
          </ul>
        </div>
      </div>

      <aside>
        {featured.project && (
          <FeaturedProjectCard
            onNavigate={onNavigate}
            project={featured.project}
          />
        )}
      </aside>
    </div>
  );
}
