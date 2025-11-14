"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Loader2 } from "lucide-react";
import { Card } from "@repo/ui/components/ui/card";
import { TeamMemberCard } from "./team-member-card";
import type { DepartmentBoard } from "@repo/api/types/appwrite";
import type { Locale } from "@/i18n/config";

interface TeamTabProps {
  fallbackTeam: DepartmentBoard[];
  campusId: string | null;
  campusName: string | null;
  locale: Locale;
}

interface CampusLeader {
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  officeLocation?: string;
  profilePhotoUrl?: string;
}

function mapToLeader(entry: any): CampusLeader {
  return {
    name: entry?.name ?? entry?.displayName ?? "",
    email: entry?.email ?? entry?.mail ?? undefined,
    phone:
      entry?.phone ??
      (Array.isArray(entry?.businessPhones) ? entry.businessPhones[0] : undefined) ??
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

export function TeamTab({ fallbackTeam, campusId, campusName, locale }: TeamTabProps) {
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
        if (cancelled) return;
        const dataset = payload?.data ?? payload;
        const members =
          Array.isArray(dataset?.members)
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
        if (cancelled) return;
        console.error("Failed to load campus leadership", error);
        setLeadership(fallbackTeam);
        if (!fallbackTeam.length) {
          setError(
            locale === "en"
              ? "Campus leadership information is not available right now."
              : "Campusledelsens informasjon er ikke tilgjengelig akkurat nå."
          );
        } else {
          setError(null);
        }
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [campusId, fallbackTeam, locale]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h2 className="text-gray-900 mb-4">
          {locale === "en" ? "Meet Our Team" : "Møt vårt team"}
        </h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          {locale === "en"
            ? `Dedicated students working to create the best campus experience${campusName ? ` at ${campusName}` : ""}`
            : `Dedikerte studenter som jobber for å skape den beste campusopplevelsen${campusName ? ` ved ${campusName}` : ""}`}
        </p>
      </motion.div>

      {loading ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-primary-50" />
            <span>
              {locale === "en" ? "Loading team..." : "Laster team..."}
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Card
                key={index}
                className="h-full rounded-3xl border border-primary/10 bg-white/80 p-6 shadow-card animate-pulse"
              >
                <div className="flex flex-col items-center gap-4">
                  <div className="h-32 w-32 rounded-full bg-primary/10" />
                  <div className="flex flex-col items-center gap-2 w-full">
                    <div className="h-4 w-32 rounded bg-primary/10" />
                    <div className="h-3 w-24 rounded bg-primary/10" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : leadership.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {leadership.map((member, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <TeamMemberCard member={member} />
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-primary/20 p-8 text-center text-sm text-muted-foreground">
          {error ||
            (locale === "en"
              ? "We will update team information soon."
              : "Vi vil oppdatere teaminformasjon snart.")}
        </div>
      )}
    </>
  );
}

