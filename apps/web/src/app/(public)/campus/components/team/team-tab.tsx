"use client";

import type { DepartmentBoard } from "@repo/api/types/appwrite";
import type { Locale } from "@repo/i18n/config";
import { Card } from "@repo/ui/components/ui/card";
import { Loader2 } from "lucide-react";
import { motion } from "motion/react";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { TeamMemberCard } from "./team-member-card";

type TeamTabProps = {
  fallbackTeam: DepartmentBoard[];
  campusId: string | null;
  campusName: string | null;
  locale: Locale;
  departmentId?: string | null;
};

// Maps campusId to the management department ID
const MANAGEMENT_DEPARTMENT_IDS: Record<string, string> = {
  "1": "2", // Oslo
  "2": "301", // Bergen
  "3": "601", // Trondheim
  "4": "801", // Stavanger
  "5": "1002", // National
};

type CampusLeader = {
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  officeLocation?: string;
  profilePhotoUrl?: string;
};

function mapToLeader(entry: any): CampusLeader {
  return {
    name: entry?.name ?? entry?.displayName ?? "",
    email: entry?.email ?? entry?.mail ?? undefined,
    phone:
      entry?.phone ??
      (Array.isArray(entry?.businessPhones)
        ? entry.businessPhones[0]
        : undefined) ??
      entry?.mobilePhone ??
      undefined,
    role: entry?.role ?? entry?.jobTitle ?? "",
    officeLocation: entry?.officeLocation ?? undefined,
    profilePhotoUrl: entry?.profilePhotoUrl ?? entry?.imageUrl ?? undefined,
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

function getTeamDescription(locale: Locale, campusName: string | null): string {
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

export function TeamTab({
  fallbackTeam,
  campusId,
  campusName,
  locale,
  departmentId,
}: TeamTabProps) {
  const [leadership, setLeadership] = useState<DepartmentBoard[]>(fallbackTeam);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If no campus is selected or we already have fallback data, don't fetch
    if (!campusId) {
      setLeadership(fallbackTeam);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    // Use provided departmentId, or fall back to management department for the campus
    const effectiveDeptId =
      departmentId ?? MANAGEMENT_DEPARTMENT_IDS[campusId] ?? "management";

    fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/campus/${campusId}/${effectiveDeptId}/board`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    )
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to fetch campus leadership");
        }
        return response.json();
      })
      .then((payload) => {
        if (cancelled) {
          return;
        }
        const members = extractMembersFromPayload(payload);
        if (Array.isArray(members) && members.length) {
          const mapped = members
            .map(mapToLeader)
            .filter((member) => member.name)
            .map(mapToDepartmentBoard);
          setLeadership(mapped);
          setError(null);
        } else {
          setLeadership(fallbackTeam);
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
        setLeadership(fallbackTeam);
        if (fallbackTeam.length) {
          setError(null);
        } else {
          setError(getLeadershipUnavailableMessage(locale));
        }
      })
      .finally(() => {
        if (cancelled) {
          return;
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [campusId, departmentId, fallbackTeam, locale]);

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
              className="h-full animate-pulse rounded-3xl border border-primary/10 /80 p-6 shadow-card"
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
  } else if (leadership.length > 0) {
    content = (
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {leadership.map((member, index) => (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            initial={{ opacity: 0, y: 20 }}
            key={index}
            transition={{ delay: index * 0.1 }}
          >
            <TeamMemberCard member={member} />
          </motion.div>
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
          {getTeamDescription(locale, campusName)}
        </p>
      </motion.div>

      {content}
    </>
  );
}
