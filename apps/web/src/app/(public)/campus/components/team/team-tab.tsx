"use client";

import type { DepartmentBoard } from "@repo/api/types/appwrite";
import { Card } from "@repo/ui/components/ui/card";
import { Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import type { Locale } from "@/i18n/config";
import { TeamMemberCard } from "./team-member-card";

type TeamTabProps = {
  fallbackTeam: DepartmentBoard[];
  campusId: string | null;
  campusName: string | null;
  locale: Locale;
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

export function TeamTab({
  fallbackTeam,
  campusId,
  campusName,
  locale,
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

    fetch("/api/campus-leadership", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campus: campusId }),
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to fetch campus leadership");
        }
        return response.json();
      })
      .then((payload) => {
        if (cancelled) {
          return;
        }
        const dataset = payload?.data ?? payload;
        const members = Array.isArray(dataset?.members)
          ? dataset.members
          : Array.isArray(dataset?.data?.members)
            ? dataset.data.members
            : [];
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
            setError(
              locale === "en"
                ? "Campus leadership information is not available right now."
                : "Campusledelsens informasjon er ikke tilgjengelig akkurat nå."
            );
          }
        }
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        console.error("Failed to load campus leadership", error);
        setLeadership(fallbackTeam);
        if (fallbackTeam.length) {
          setError(null);
        } else {
          setError(
            locale === "en"
              ? "Campus leadership information is not available right now."
              : "Campusledelsens informasjon er ikke tilgjengelig akkurat nå."
          );
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
  }, [campusId, fallbackTeam, locale]);

  return (
    <>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="mb-12 text-center"
        initial={{ opacity: 0, y: 20 }}
      >
        <h2 className="mb-4 text-gray-900">
          {locale === "en" ? "Meet Our Team" : "Møt vårt team"}
        </h2>
        <p className="mx-auto max-w-2xl text-gray-600">
          {locale === "en"
            ? `Dedicated students working to create the best campus experience${campusName ? ` at ${campusName}` : ""}`
            : `Dedikerte studenter som jobber for å skape den beste campusopplevelsen${campusName ? ` ved ${campusName}` : ""}`}
        </p>
      </motion.div>

      {loading ? (
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin text-primary-50" />
            <span>
              {locale === "en" ? "Loading team..." : "Laster team..."}
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Card
                className="h-full animate-pulse rounded-3xl border border-primary/10 bg-white/80 p-6 shadow-card"
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
      ) : leadership.length > 0 ? (
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
      ) : (
        <div className="rounded-3xl border border-primary/20 border-dashed p-8 text-center text-muted-foreground text-sm">
          {error ||
            (locale === "en"
              ? "We will update team information soon."
              : "Vi vil oppdatere teaminformasjon snart.")}
        </div>
      )}
    </>
  );
}
