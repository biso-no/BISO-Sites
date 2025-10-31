"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { useCampus } from "@/components/context/campus";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardTitle } from "@repo/ui/components/ui/card";
import { formatDateReadable } from '@repo/ui/lib/utils';

import type { JobWithTranslations } from "@/lib/types/job";

interface JobsContentProps {
  jobs: JobWithTranslations[];
}

export function JobsContent({ jobs }: JobsContentProps) {
  const { campuses, activeCampusId } = useCampus();
  const t = useTranslations("home");
  const commonT = useTranslations("common");

  const campusLookup = useMemo(() => {
    return campuses.reduce<Record<string, string>>((acc, campus) => {
      acc[campus.$id] = campus.name;
      return acc;
    }, {});
  }, [campuses]);

  const filteredJobs = useMemo(() => {
    if (!activeCampusId) return jobs;
    return jobs.filter((job) => job.campus_id === activeCampusId);
  }, [jobs, activeCampusId]);

  const spotlightJobs = useMemo(() => filteredJobs.slice(0, 6), [filteredJobs]);

  if (filteredJobs.length === 0) {
    return (
      <div className="col-span-full rounded-2xl border border-dashed border-primary/20 bg-white/60 p-10 text-center text-muted-foreground">
        {t("jobs.empty")}
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {spotlightJobs.map((job) => (
        <Card key={job.$id} className="flex h-full flex-col justify-between border border-primary/10 bg-white/90 shadow-md transition hover:-translate-y-1 hover:shadow-card-hover">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span className="rounded-full bg-primary/10 px-2 py-1 text-primary-30">
                {campusLookup[job.campus_id] ?? commonT("labels.organisation")}
              </span>
              <span>
                {job.application_deadline
                  ? t("jobs.deadline", { date: formatDateReadable(job.application_deadline) })
                  : t("jobs.rolling")}
              </span>
            </div>
            <CardTitle className="text-lg font-semibold text-primary-100">
              <Link href={`/jobs/${job.slug}`} className="hover:underline">
                {job.title}
              </Link>
            </CardTitle>
            <p className="line-clamp-3 text-sm text-muted-foreground">
              {job.description?.replace(/<[^>]+>/g, "").slice(0, 160)}
              {job.description && job.description.length > 160 ? "…" : ""}
            </p>
          </CardContent>
          <div className="px-6 pb-6">
            <Button asChild variant="outline" className="w-full">
              <Link href={`/jobs/${job.slug}`}>{commonT("buttons.readMore")}</Link>
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
