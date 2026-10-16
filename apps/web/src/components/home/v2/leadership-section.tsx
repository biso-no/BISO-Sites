import { getTranslations } from "next-intl/server";
import { CardGrid } from "@/components/ui/card-grid";
import { PersonCard } from "@/components/ui/person-card";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";
import {
  HOME_LEADERSHIP_LIMIT,
  type LeadershipMember,
  managementDepartmentId,
} from "@/lib/campus-leadership";
import { NATIONAL_CAMPUS_ID } from "@/lib/campus-scope";
import { cachedUnitBoard } from "@/lib/data/unit-board";

/**
 * The people running BISO where the visitor is: the campus management unit's
 * board from Microsoft 365, or the national Operations Unit when no campus is
 * selected.
 *
 * Fetches its own board so the page can stream around it — render it inside
 * its own `<Suspense>`. The directory read is cached for hours, but a miss on
 * a slow day must not hold the whole front page. The cached reader throws on
 * failure by design (see `lib/data`); the fallback lives here, at the call
 * site, so the section simply does not render for this one request and the
 * outage is never cached as an empty board.
 */
export interface LeadershipSectionProps {
  /** The campus whose board to show; National when none is selected. */
  campusId: string;
  /** The selected campus for the heading; null for all campuses and National. */
  campusName: string | null;
  /** The management unit's own page, where the whole board lives. */
  teamHref: string | null;
}

export async function LeadershipSection({
  campusId,
  campusName,
  teamHref,
}: LeadershipSectionProps) {
  const members = await loadBoard(campusId);
  if (members.length === 0) {
    return null;
  }
  const [t, tLabels] = await Promise.all([
    getTranslations("home.leadership"),
    getTranslations("common.labels"),
  ]);
  const isNational = campusId === NATIONAL_CAMPUS_ID;
  const shown = members.slice(0, HOME_LEADERSHIP_LIMIT);
  // "See the whole team" only when there is more to see: the sun marker under
  // the heading means exactly that (spec §7.3).
  const seeAllHref =
    teamHref && members.length > shown.length ? teamHref : undefined;

  return (
    <Section className="border-edge border-t" id="leadership" tone="paper">
      <SectionHeading seeAllHref={seeAllHref} seeAllLabel={t("cta")}>
        {isNational || !campusName
          ? t("title")
          : t("titleCampus", { campusName })}
      </SectionHeading>
      <p className="type-body-sm mb-6 max-w-(--measure) text-ink-muted">
        {isNational ? t("description") : t("descriptionCampus")}
      </p>
      <CardGrid>
        {shown.map((member) => (
          <li key={member.email ?? `${member.name}-${member.role}`}>
            <PersonCard
              className="h-full"
              email={member.email}
              emailLabel={tLabels("emailPerson", { name: member.name })}
              imageUrl={member.imageUrl}
              name={member.name}
              position={member.role}
            />
          </li>
        ))}
      </CardGrid>
    </Section>
  );
}

async function loadBoard(campusId: string): Promise<LeadershipMember[]> {
  const departmentId = managementDepartmentId(campusId);
  if (!departmentId) {
    return [];
  }
  try {
    return await cachedUnitBoard(campusId, departmentId);
  } catch {
    return [];
  }
}

const SKELETON_PEOPLE = [0, 1, 2, 3, 4, 5];

/**
 * The leadership section's Suspense fallback, shaped like the cards it
 * precedes. Still blocks on `--surface-sunken` rather than a pulse, like the
 * shared `loading-shell` skeletons: `animate-pulse` ignores reduced motion.
 */
export function LeadershipSkeleton() {
  return (
    <Section as="div" className="border-edge border-t" tone="paper">
      <div className="mb-6 h-8 w-56 max-w-full rounded-biso-sm bg-surface-sunken" />
      <div className="mb-6 h-4 w-full max-w-(--measure) rounded-biso-sm bg-surface-sunken" />
      <CardGrid as="div">
        {SKELETON_PEOPLE.map((slot) => (
          <div
            className="flex flex-col items-center gap-3 rounded-biso-md border border-edge p-5"
            key={slot}
          >
            <div className="size-16 rounded-biso-pill bg-surface-sunken" />
            <div className="h-5 w-32 rounded-biso-sm bg-surface-sunken" />
            <div className="h-4 w-24 rounded-biso-sm bg-surface-sunken" />
          </div>
        ))}
      </CardGrid>
    </Section>
  );
}
