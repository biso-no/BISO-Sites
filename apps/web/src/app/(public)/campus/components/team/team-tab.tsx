"use client";

import type { DepartmentBoard } from "@repo/api/types/appwrite";
import type { Locale } from "@repo/i18n/config";
import { Card } from "@repo/ui/components/ui/card";
import { Loader2 } from "lucide-react";
import { motion } from "motion/react";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { NATIONAL_CAMPUS_ID } from "@/lib/campus-scope";
import { TeamMemberCard } from "./team-member-card";

interface TeamTabProps {
  campusId: string | null;
  campusName: string | null;
  departmentId?: string | null;
  fallbackTeam: DepartmentBoard[];
  locale: Locale;
}

// Maps campusId to the management department ID
const MANAGEMENT_DEPARTMENT_IDS: Record<string, string> = {
  "1": "2", // Oslo
  "2": "301", // Bergen
  "3": "601", // Trondheim
  "4": "801", // Stavanger
  "5": "1002", // National
};

interface BoardGroup {
  // Department path segment for the board API: a numeric department id (resolved
  // to a DB row) or a literal Azure AD `department` name.
  segment: string;
  titleEn: string;
  titleNo: string;
}

// National leadership is split across several units/committees rather than a
// single board, so we fetch and render each group on its own.
const NATIONAL_GROUPS: BoardGroup[] = [
  {
    segment: MANAGEMENT_DEPARTMENT_IDS[NATIONAL_CAMPUS_ID],
    titleEn: "Operations Unit",
    titleNo: "Operations Unit",
  },
  {
    segment: "Administration",
    titleEn: "Administration",
    titleNo: "Administrasjon",
  },
  {
    segment: "Control Committee",
    titleEn: "Control Committee",
    titleNo: "Kontrollkomiteen",
  },
  {
    segment: "Branding Committee",
    titleEn: "Branding Committee",
    titleNo: "Brandingkomiteen",
  },
];

interface CampusLeader {
  email?: string;
  name: string;
  officeLocation?: string;
  phone?: string;
  profilePhotoUrl?: string;
  role?: string;
}

interface TeamSection {
  key: string;
  members: DepartmentBoard[];
  title: string | null;
}

const getString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

function mapToLeader(entry: Record<string, unknown>): CampusLeader {
  return {
    name: getString(entry.name) ?? getString(entry.displayName) ?? "",
    email: getString(entry.email) ?? getString(entry.mail),
    phone:
      getString(entry.phone) ??
      (Array.isArray(entry?.businessPhones)
        ? getString(entry.businessPhones[0])
        : undefined) ??
      getString(entry.mobilePhone),
    role: getString(entry.role) ?? getString(entry.jobTitle) ?? "",
    officeLocation: getString(entry.officeLocation),
    profilePhotoUrl:
      getString(entry.profilePhotoUrl) ?? getString(entry.imageUrl),
  };
}

function mapToDepartmentBoard(leader: CampusLeader): DepartmentBoard {
  return {
    name: leader.name,
    role: leader.role || "",
    imageUrl: leader.profilePhotoUrl || null,
  } as DepartmentBoard;
}

function getLeadershipUnavailableMessage(locale: Locale): string {
  if (locale === "en") {
    return "Campus leadership information is not available right now.";
  }
  return "Campusledelsens informasjon er ikke tilgjengelig akkurat nå.";
}

function getTeamDescription(
  locale: Locale,
  campusName: string | null,
  campusId: string | null
): string {
  // National is staffed by both elected students and employed staff, so the
  // generic "students" copy used for the campuses does not apply here.
  if (campusId === NATIONAL_CAMPUS_ID) {
    return locale === "en"
      ? "A team of elected students and employed staff working to develop BISO nationally."
      : "Et team av valgte studenter og ansatte som jobber for å utvikle BISO nasjonalt.";
  }

  const hasCampusName = Boolean(campusName);
  if (locale === "en") {
    const suffix = hasCampusName ? ` at ${campusName}` : "";
    return `Dedicated students working to create the best campus experience${suffix}`;
  }
  const suffix = hasCampusName ? ` ved ${campusName}` : "";
  return `Dedikerte studenter som jobber for å skape den beste campusopplevelsen${suffix}`;
}

function extractMembersFromPayload(payload: unknown): unknown[] {
  const dataset = (payload as { data?: unknown; members?: unknown }) ?? {};
  const rootMembers = (dataset as { members?: unknown }).members;
  if (Array.isArray(rootMembers)) {
    return rootMembers;
  }

  const nestedData = (dataset as { data?: { members?: unknown } }).data;
  if (Array.isArray(nestedData?.members)) {
    return nestedData.members;
  }

  return [];
}

async function fetchGroupMembers(
  campusId: string,
  segment: string
): Promise<DepartmentBoard[]> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/campus/${campusId}/${encodeURIComponent(segment)}/board`,
    {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    }
  );
  if (!response.ok) {
    throw new Error("Failed to fetch campus leadership");
  }
  const payload: unknown = await response.json();
  return extractMembersFromPayload(payload)
    .filter(
      (entry): entry is Record<string, unknown> =>
        typeof entry === "object" && entry !== null
    )
    .map(mapToLeader)
    .filter((member) => member.name)
    .map(mapToDepartmentBoard);
}

async function fetchNationalSections(locale: Locale): Promise<TeamSection[]> {
  const results = await Promise.all(
    NATIONAL_GROUPS.map(async (group) => ({
      group,
      members: await fetchGroupMembers(NATIONAL_CAMPUS_ID, group.segment).catch(
        () => [] as DepartmentBoard[]
      ),
    }))
  );

  return results
    .filter(({ members }) => members.length > 0)
    .map(({ group, members }) => ({
      key: group.segment,
      title: locale === "en" ? group.titleEn : group.titleNo,
      members,
    }));
}

function fallbackSection(members: DepartmentBoard[]): TeamSection[] {
  return [{ key: "fallback", title: null, members }];
}

export function TeamTab({
  fallbackTeam,
  campusId,
  campusName,
  locale,
  departmentId,
}: TeamTabProps) {
  const [sections, setSections] = useState<TeamSection[]>(() =>
    fallbackSection(fallbackTeam)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If no campus is selected, just show the fallback data.
    if (!campusId) {
      setSections(fallbackSection(fallbackTeam));
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const effectiveDeptId =
      departmentId ?? MANAGEMENT_DEPARTMENT_IDS[campusId] ?? "management";

    const load = async (): Promise<TeamSection[]> => {
      if (campusId === NATIONAL_CAMPUS_ID) {
        return await fetchNationalSections(locale);
      }
      const members = await fetchGroupMembers(campusId, effectiveDeptId);
      return [{ key: "team", title: null, members }];
    };

    load()
      .then((loaded) => {
        if (cancelled) {
          return;
        }
        const hasMembers = loaded.some((section) => section.members.length > 0);
        if (hasMembers) {
          setSections(loaded);
          setError(null);
        } else {
          setSections(fallbackSection(fallbackTeam));
          if (!fallbackTeam.length) {
            setError(getLeadershipUnavailableMessage(locale));
          }
        }
      })
      .catch((fetchError) => {
        if (cancelled) {
          return;
        }
        console.error("Failed to load campus leadership", fetchError);
        setSections(fallbackSection(fallbackTeam));
        setError(
          fallbackTeam.length ? null : getLeadershipUnavailableMessage(locale)
        );
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [campusId, departmentId, fallbackTeam, locale]);

  const visibleSections = sections.filter(
    (section) => section.members.length > 0
  );

  let content: JSX.Element;
  if (loading) {
    content = (
      <div className="space-y-4">
        <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin text-primary-50" />
          <span>{locale === "en" ? "Loading team..." : "Laster team..."}</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card
              className="/80 h-full animate-pulse rounded-3xl border border-primary/10 p-6 shadow-card"
              key={index}
            >
              <div className="flex flex-col items-center gap-4">
                <div className="h-32 w-32 rounded-full bg-primary/10" />
                <div className="flex w-full flex-col items-center gap-2">
                  <div className="h-4 w-32 rounded bg-primary/10" />
                  <div className="h-3 w-24 rounded bg-primary/10" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  } else if (visibleSections.length > 0) {
    content = (
      <div className="space-y-16">
        {visibleSections.map((section) => (
          <section key={section.key}>
            {section.title ? (
              <h3 className="mb-6 text-center text-foreground">
                {section.title}
              </h3>
            ) : null}
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {section.members.map((member, index) => (
                <motion.div
                  animate={{ opacity: 1, y: 0 }}
                  initial={{ opacity: 0, y: 20 }}
                  key={`${section.key}-${index}`}
                  transition={{ delay: index * 0.1 }}
                >
                  <TeamMemberCard member={member} />
                </motion.div>
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  } else {
    const fallbackMessage =
      locale === "en"
        ? "We will update team information soon."
        : "Vi vil oppdatere teaminformasjon snart.";
    content = (
      <div className="rounded-3xl border border-primary/20 border-dashed p-8 text-center text-muted-foreground text-sm">
        {error ?? fallbackMessage}
      </div>
    );
  }

  return (
    <>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="mb-12 text-center"
        initial={{ opacity: 0, y: 20 }}
      >
        <h2 className="mb-4 text-foreground">
          {locale === "en" ? "Meet Our Team" : "Møt vårt team"}
        </h2>
        <p className="mx-auto max-w-2xl text-muted-foreground">
          {getTeamDescription(locale, campusName, campusId)}
        </p>
      </motion.div>

      {content}
    </>
  );
}
