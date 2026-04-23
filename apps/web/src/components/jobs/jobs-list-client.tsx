"use client";

import type { RecruitmentVacancy } from "@repo/shared/types/recruitment";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { DollarSign, Search, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { JobCard } from "./job-card";

interface JobsListClientProps {
  jobs: RecruitmentVacancy[];
}

export function JobsListClient({ jobs }: JobsListClientProps) {
  const t = useTranslations("jobs");
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [showPaidOnly, setShowPaidOnly] = useState(false);

  const filteredJobs = jobs.filter((job) => {
    const translation = job.translation_refs[0];
    const title = translation?.title ?? "";
    const description = translation?.description ?? "";
    const shortDescription =
      job.metadata.short_description || translation?.short_description || "";
    const department = job.department?.Name || "";
    const company = job.metadata.company || "";
    const matchesSearch =
      title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shortDescription.toLowerCase().includes(searchQuery.toLowerCase()) ||
      department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      company.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch && (!showPaidOnly || Boolean(job.metadata.paid));
  });

  function handleViewDetails(job: RecruitmentVacancy) {
    router.push(`/jobs/${job.slug || job.$id}`);
  }

  return (
    <>
      <div className="sticky top-20 z-40 border-border border-b bg-background/95 shadow-lg backdrop-blur-lg">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4">
            <div className="relative w-full">
              <Search className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="w-full border-brand-border pr-10 pl-10 focus:border-brand"
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t("filters.searchPlaceholder")}
                type="text"
                value={searchQuery}
              />
              {searchQuery ? (
                <button
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setSearchQuery("")}
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            <div className="flex items-center justify-end">
              <Button
                className={
                  showPaidOnly
                    ? "border-0 bg-linear-to-r from-green-500 to-emerald-600 text-white"
                    : "border-green-500/20 text-green-700 hover:bg-green-50"
                }
                onClick={() => setShowPaidOnly((value) => !value)}
                variant={showPaidOnly ? "default" : "outline"}
              >
                <DollarSign className="mr-2 h-4 w-4" />
                {t("filters.paidOnly")}
              </Button>
            </div>

            <div className="text-center text-muted-foreground text-sm">
              {t("filters.showingResults", { count: filteredJobs.length })}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <AnimatePresence mode="wait">
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="grid gap-8 md:grid-cols-2"
            exit={{ opacity: 0, y: -20 }}
            initial={{ opacity: 0, y: 20 }}
            key={`${searchQuery}-${showPaidOnly}`}
          >
            {filteredJobs.map((job, index) => (
              <JobCard
                index={index}
                job={job}
                key={job.$id}
                onViewDetails={handleViewDetails}
              />
            ))}
          </motion.div>
        </AnimatePresence>

        {filteredJobs.length === 0 ? (
          <motion.div
            animate={{ opacity: 1 }}
            className="py-20 text-center"
            initial={{ opacity: 0 }}
          >
            <h3 className="mb-2 font-bold text-2xl text-foreground">
              {t("emptyState.title")}
            </h3>
            <p className="mb-6 text-muted-foreground">
              {t("emptyState.description")}
            </p>
            <Button
              className="border-brand text-brand-dark hover:bg-brand-muted"
              onClick={() => {
                setSearchQuery("");
                setShowPaidOnly(false);
              }}
              variant="outline"
            >
              {t("emptyState.clearFilters")}
            </Button>
          </motion.div>
        ) : null}
      </div>
    </>
  );
}
