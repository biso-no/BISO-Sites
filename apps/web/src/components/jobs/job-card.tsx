"use client";

import type { ContentTranslations } from "@repo/api/types/appwrite";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { ArrowRight, DollarSign, Heart, Users } from "lucide-react";
import { motion } from "motion/react";

type JobCardProps = {
  job: ContentTranslations;
  index: number;
  onViewDetails: (job: ContentTranslations) => void;
};

const getJobCategory = (metadata: Record<string, any>) =>
  metadata.category || "General";

const formatSalary = (salary: number) =>
  salary.toLocaleString("no-NO", { style: "currency", currency: "NOK" });

const categoryColors: Record<string, string> = {
  "Academic Associations": "bg-blue-100 text-blue-700 border-blue-200",
  Societies: "bg-brand-muted text-brand-dark border-brand-border",
  "Staff Functions": "bg-slate-100 text-slate-700 border-slate-200",
  Projects: "bg-purple-100 text-purple-700 border-purple-200",
};

export function JobCard({ job, index, onViewDetails }: JobCardProps) {
  const jobData = job.job_ref;
  const metadata = jobData?.metadata as Record<string, any>;
  const category = getJobCategory(metadata);

  const paid = metadata.paid ?? false;
  const salary = formatSalary(metadata.salary);
  const openings = metadata.openings || 1;
  const responsibilities = metadata.responsibilities || [];
  const requirements = metadata.requirements || [];
  const deadline = metadata.deadline || "Rolling basis";
  const department = jobData?.department?.Name || "General";

  // Use short_description if available, otherwise truncate description
  const shortDescription =
    job.short_description ||
    (job.description.length > 150
      ? `${job.description.substring(0, 150)}...`
      : job.description);

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      initial={{ opacity: 0, y: 20 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card className="group flex h-full flex-col overflow-hidden border-0 shadow-lg transition-all duration-300 hover:shadow-2xl">
        {/* Header */}
        <div className="relative bg-linear-to-br from-brand-gradient-to to-brand-gradient-from p-6 text-white">
          <div className="mb-4 flex items-start justify-between">
            <div className="flex-1">
              <Badge className={`mb-3 ${categoryColors[category]}`}>
                {category}
              </Badge>
              <h3 className="mb-2 font-bold text-white text-xl">{job.title}</h3>
              <p className="text-sm text-white/80">{department}</p>
            </div>
            {paid && (
              <div className="flex items-center gap-1 rounded-full bg-green-500 px-3 py-1 font-medium text-sm text-white">
                <DollarSign className="h-4 w-4" />
                Paid
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 text-sm text-white/80">
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>
                {openings} {openings === 1 ? "opening" : "openings"}
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex grow flex-col p-6">
          <p className="mb-4 text-muted-foreground">{shortDescription}</p>

          {paid && salary && (
            <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3">
              <div className="flex items-center gap-2 text-green-700">
                <DollarSign className="h-5 w-5" />
                <span className="font-semibold">Salary: {salary}</span>
              </div>
            </div>
          )}

          {!paid && (
            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
              <div className="flex items-center gap-2 text-blue-700">
                <Heart className="h-5 w-5" />
                <span className="font-semibold">Volunteer Position</span>
              </div>
            </div>
          )}

          <div className="mb-4 grow space-y-4">
            {responsibilities.length > 0 && (
              <div>
                <h4 className="mb-2 font-semibold text-foreground text-sm">
                  Responsibilities
                </h4>
                <ul className="space-y-1 text-muted-foreground text-sm">
                  {responsibilities
                    .slice(0, 3)
                    .map((resp: string, idx: number) => (
                      <li className="flex items-start gap-2" key={idx}>
                        <span className="mt-1 text-brand">•</span>
                        <span>{resp}</span>
                      </li>
                    ))}
                </ul>
              </div>
            )}

            {requirements.length > 0 && (
              <div>
                <h4 className="mb-2 font-semibold text-foreground text-sm">
                  Requirements
                </h4>
                <ul className="space-y-1 text-muted-foreground text-sm">
                  {requirements.slice(0, 3).map((req: string, idx: number) => (
                    <li className="flex items-start gap-2" key={idx}>
                      <span className="mt-1 text-brand">•</span>
                      <span>{req}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="mt-auto border-border border-t pt-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-muted-foreground text-sm">
                Application Deadline
              </span>
              <span className="font-medium text-brand-dark text-sm">
                {deadline}
              </span>
            </div>
            <Button
              className="w-full border-0 bg-linear-to-r from-brand-gradient-from to-brand-gradient-to text-white hover:from-brand-gradient-from/90 hover:to-brand-gradient-to/90"
              onClick={() => onViewDetails(job)}
            >
              View Details
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
