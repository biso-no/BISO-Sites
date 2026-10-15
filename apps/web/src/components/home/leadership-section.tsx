import { Button } from "@repo/ui/components/ui/button";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { TeamMemberCard } from "@/app/(public)/campus/components/team/team-member-card";
import {
  HOME_LEADERSHIP_LIMIT,
  type LeadershipMember,
  managementDepartmentId,
} from "@/lib/campus-leadership";
import { NATIONAL_CAMPUS_ID } from "@/lib/campus-scope";
import { cachedUnitBoard } from "@/lib/data/unit-board";

interface LeadershipSectionProps {
  /** The campus whose board to show; National when none is selected. */
  campusId: string;
  campusName: string | null;
  /** The management unit's own page, where the whole board lives. */
  teamHref: string | null;
}

/**
 * The people running BISO where the visitor is: the campus board, or the
 * national Operations Unit when no campus is selected.
 *
 * Fetches its own board so the page can stream around it: the directory read
 * is cached for hours, but a miss on a slow day must not hold the whole
 * front page. The cached reader throws on failure by design (see
 * `lib/data`); the section then simply does not render, this render only.
 */
export async function LeadershipSection({
  campusId,
  campusName,
  teamHref,
}: LeadershipSectionProps) {
  const members = await loadBoard(campusId);
  if (members.length === 0) {
    return null;
  }
  const t = await getTranslations("home.leadership");
  const isNational = campusId === NATIONAL_CAMPUS_ID;
  const shown = members.slice(0, HOME_LEADERSHIP_LIMIT);

  return (
    <section className="py-16" id="leadership">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="mb-2 font-bold text-3xl text-foreground md:text-4xl">
              {isNational || !campusName
                ? t("title")
                : t("titleCampus", { campusName })}
            </h2>
            <p className="max-w-2xl text-muted-foreground">
              {isNational ? t("description") : t("descriptionCampus")}
            </p>
          </div>
          {teamHref && members.length > shown.length ? (
            <Button asChild variant="outline">
              <Link href={teamHref}>{t("cta")}</Link>
            </Button>
          ) : null}
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((member) => (
            <TeamMemberCard
              key={member.email ?? `${member.name}-${member.role}`}
              member={{
                email: member.email ?? undefined,
                imageUrl: member.imageUrl,
                name: member.name,
                role: member.role ?? undefined,
              }}
            />
          ))}
        </div>
      </div>
    </section>
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
