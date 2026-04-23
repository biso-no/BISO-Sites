"use client";

import type { RecruitmentVacancy } from "@repo/shared/types/recruitment";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  MapPin,
} from "lucide-react";
import { motion } from "motion/react";

interface JobCardProps {
  index: number;
  job: RecruitmentVacancy;
  onViewDetails: (job: RecruitmentVacancy) => void;
}

export function JobCard({ job, index, onViewDetails }: JobCardProps) {
  const translation = job.translation_refs[0];
  const title = translation?.title ?? "Untitled";
  const shortDescription =
    job.metadata.short_description ||
    translation?.short_description ||
    translation?.description ||
    "No vacancy description available.";
  const department = job.department?.Name || "BISO";
  const company = job.metadata.company || "BISO";
  const employmentType = job.metadata.employment_type || "Position";
  const deadline = job.metadata.application_deadline
    ? new Date(job.metadata.application_deadline).toLocaleDateString("en-GB")
    : "Rolling";

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      initial={{ opacity: 0, y: 20 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card className="group flex h-full flex-col border-border/60 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
        <div className="border-border/60 border-b bg-linear-to-r from-brand-gradient-from/10 to-brand-gradient-to/10 p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <Badge variant="outline">{employmentType}</Badge>
              <h3 className="font-semibold text-2xl text-foreground">
                {title}
              </h3>
              <p className="text-muted-foreground text-sm">{company}</p>
            </div>
            {job.metadata.paid ? (
              <Badge>Paid</Badge>
            ) : (
              <Badge variant="secondary">Volunteer</Badge>
            )}
          </div>
        </div>

        <div className="flex grow flex-col p-6">
          <p className="line-clamp-4 text-muted-foreground text-sm leading-6">
            {shortDescription}
          </p>

          <div className="mt-5 grid gap-3 text-muted-foreground text-sm">
            <div className="flex items-center gap-2">
              <BriefcaseBusiness className="h-4 w-4" />
              <span>{department}</span>
            </div>
            {job.metadata.location ? (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>{job.metadata.location}</span>
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              <span>Apply by {deadline}</span>
            </div>
          </div>

          <div className="mt-auto pt-6">
            <Button className="w-full" onClick={() => onViewDetails(job)}>
              View vacancy
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
