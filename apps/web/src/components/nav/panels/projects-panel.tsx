"use client";

import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { useCampus } from "@/components/context/campus";
import { useScopedCampusId } from "@/components/context/use-scoped-campus";
import {
  projectLinkLabel,
  visibleProjectLinks,
} from "@/lib/project-unit-links";
import type { NavFeatured, NavProjectLink } from "@/lib/types/nav";
import { FeaturedProjectCard } from "../featured-project-card";
import { PANEL_HEADING_CLASS, PanelLink } from "../mega-panel";
import {
  PROJECT_FLAGSHIP_ICON,
  PROJECT_FLAGSHIP_KEYS,
  PROJECT_LINKS,
} from "../nav-config";

interface ProjectsPanelProps {
  featured: NavFeatured;
  onNavigate: () => void;
  projectLinks: NavProjectLink[];
}

export function ProjectsPanel({
  featured,
  onNavigate,
  projectLinks,
}: ProjectsPanelProps) {
  const t = useTranslations("common.navigation");
  const tProjects = useTranslations("projects.featured");

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className={PANEL_HEADING_CLASS}>{t("columns.flagships")}</h3>
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
          <CampusProjectLinks
            className="mt-6"
            onNavigate={onNavigate}
            projectLinks={projectLinks}
          />
        </div>
        <div>
          <h3 className={PANEL_HEADING_CLASS}>{t("events")}</h3>
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

interface CampusProjectLinksProps {
  className?: string;
  /** `h3` inside the desktop panel; the drawer's groups are not headings. */
  headingAs?: "h3" | "p";
  onNavigate: () => void;
  projectLinks: NavProjectLink[];
}

/**
 * The project units for the campus the visitor is looking at, below the
 * flagship hubs: that campus's project units plus the national ones, or — with
 * no campus chosen — every unit except a hub project's per-campus copies
 * (`visibleProjectLinks`). Shared by the desktop panel and the mobile drawer.
 *
 * The campus is resolved the way the header's campus control resolves it, URL
 * first and then the stored preference, so `/events?campus=bergen` lists
 * Bergen's projects under a control that says Bergen. `useScopedCampusId`
 * reads the query string, so it gets its own Suspense boundary; the fallback
 * is the preference-only answer.
 */
export function CampusProjectLinks(props: CampusProjectLinksProps) {
  const { activeCampusId } = useCampus();

  return (
    <Suspense
      fallback={<CampusProjectLinksView campusId={activeCampusId} {...props} />}
    >
      <ScopedCampusProjectLinks {...props} />
    </Suspense>
  );
}

function ScopedCampusProjectLinks(props: CampusProjectLinksProps) {
  return <CampusProjectLinksView campusId={useScopedCampusId()} {...props} />;
}

function CampusProjectLinksView({
  campusId,
  className,
  headingAs: Heading = "h3",
  onNavigate,
  projectLinks,
}: CampusProjectLinksProps & { campusId: string | null }) {
  const t = useTranslations("common.navigation");
  const links = visibleProjectLinks(projectLinks, campusId);

  // No project unit has a public page for this campus: the hubs above stand
  // alone rather than sitting over an empty heading.
  if (links.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <Heading className={PANEL_HEADING_CLASS}>
        {campusId ? t("columns.campusProjects") : t("columns.moreProjects")}
      </Heading>
      <ul className="space-y-0.5">
        {links.map((link) => (
          <li key={link.id}>
            <PanelLink
              href={link.href}
              icon={PROJECT_FLAGSHIP_ICON}
              label={projectLinkLabel(link, campusId)}
              onNavigate={onNavigate}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
