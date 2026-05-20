"use client";

import type { RecruitmentVacancy } from "@repo/shared/types/recruitment";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { DollarSign, Search, SlidersHorizontal, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useCampus } from "@/components/context/campus";
import { JobCard } from "./job-card";

interface JobsListClientProps {
  initialDepartment?: string | null;
  initialSearch?: string;
  jobs: RecruitmentVacancy[];
}

const SORT_OPTIONS = [
  { label: "Newest first", value: "newest" },
  { label: "Deadline (soonest)", value: "deadline" },
  { label: "A–Z", value: "alpha" },
] as const;

type SortOption = (typeof SORT_OPTIONS)[number]["value"];

function sortJobs(jobs: RecruitmentVacancy[], sort: SortOption): RecruitmentVacancy[] {
  return [...jobs].sort((a, b) => {
    if (sort === "deadline") {
      const da = a.metadata.application_deadline
        ? new Date(a.metadata.application_deadline).getTime()
        : Number.POSITIVE_INFINITY;
      const db = b.metadata.application_deadline
        ? new Date(b.metadata.application_deadline).getTime()
        : Number.POSITIVE_INFINITY;
      return da - db;
    }
    if (sort === "alpha") {
      const ta = a.translations[0]?.title ?? "";
      const tb = b.translations[0]?.title ?? "";
      return ta.localeCompare(tb);
    }
    // newest first (default — already ordered by createdAt from server)
    return new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime();
  });
}

export function JobsListClient({
  initialDepartment,
  initialSearch = "",
  jobs,
}: JobsListClientProps) {
  const t = useTranslations("jobs");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeCampusId } = useCampus();

  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [showPaidOnly, setShowPaidOnly] = useState(
    searchParams.get("paid") === "true"
  );
  const [employmentType, setEmploymentType] = useState(
    searchParams.get("type") ?? "all"
  );
  const [sort, setSort] = useState<SortOption>(
    (searchParams.get("sort") as SortOption | null) ?? "newest"
  );
  const [showFilters, setShowFilters] = useState(false);

  // Derive unique employment types from jobs
  const employmentTypes = useMemo(() => {
    const types = new Set(
      jobs.map((j) => j.metadata.employment_type).filter(Boolean)
    );
    return Array.from(types);
  }, [jobs]);

  // Derive unique departments
  const departments = useMemo(() => {
    const seen = new Map<string, string>();
    for (const j of jobs) {
      if (j.department_id && j.department?.Name) {
        seen.set(j.department_id, j.department.Name);
      }
    }
    return Array.from(seen.entries());
  }, [jobs]);

  const [department, setDepartment] = useState(initialDepartment ?? "all");

  // When campus switcher changes, re-fetch via URL update (triggers server rerender)
  useEffect(() => {
    if (activeCampusId === undefined) return; // still loading
    const params = new URLSearchParams(window.location.search);
    const currentCampus = params.get("campus");
    const newCampus = activeCampusId ?? "all";
    if (currentCampus !== newCampus && !(currentCampus === null && newCampus === "all")) {
      if (newCampus === "all") {
        params.delete("campus");
      } else {
        params.set("campus", newCampus);
      }
      router.replace(`/jobs?${params.toString()}`);
    }
  }, [activeCampusId, router]);

  // Push filter changes into URL so pages are shareable
  function updateUrl(overrides: Record<string, string | null>) {
    const params = new URLSearchParams(window.location.search);
    for (const [key, val] of Object.entries(overrides)) {
      if (val === null || val === "" || val === "all" || val === "false") {
        params.delete(key);
      } else {
        params.set(key, val);
      }
    }
    router.replace(`/jobs?${params.toString()}`, { scroll: false });
  }

  const filteredJobs = useMemo(() => {
    const lowerSearch = searchQuery.toLowerCase();
    return sortJobs(
      jobs.filter((job) => {
        const t0 = job.translations[0];
        const title = (t0?.title ?? "").toLowerCase();
        const desc = (t0?.description ?? "").toLowerCase();
        const short = (job.metadata.short_description ?? t0?.short_description ?? "").toLowerCase();
        const dept = (job.department?.Name ?? "").toLowerCase();
        const company = (job.metadata.company ?? "").toLowerCase();

        const matchesSearch =
          !lowerSearch ||
          title.includes(lowerSearch) ||
          desc.includes(lowerSearch) ||
          short.includes(lowerSearch) ||
          dept.includes(lowerSearch) ||
          company.includes(lowerSearch);

        const matchesPaid = !showPaidOnly || job.metadata.paid === true;
        const matchesType =
          employmentType === "all" ||
          job.metadata.employment_type === employmentType;
        const matchesDept =
          department === "all" || job.department_id === department;

        return matchesSearch && matchesPaid && matchesType && matchesDept;
      }),
      sort
    );
  }, [jobs, searchQuery, showPaidOnly, employmentType, department, sort]);

  function clearAllFilters() {
    setSearchQuery("");
    setShowPaidOnly(false);
    setEmploymentType("all");
    setDepartment("all");
    setSort("newest");
    updateUrl({
      q: null,
      paid: null,
      type: null,
      department: null,
      sort: null,
    });
  }

  const hasActiveFilters =
    searchQuery.length > 0 ||
    showPaidOnly ||
    employmentType !== "all" ||
    department !== "all" ||
    sort !== "newest";

  function handleViewDetails(job: RecruitmentVacancy) {
    router.push(`/jobs/${job.slug || job.$id}`);
  }

  return (
    <>
      {/* Sticky filter bar */}
      <div className="sticky top-20 z-40 border-border border-b bg-background/95 shadow-lg backdrop-blur-lg">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3">
            {/* Search + filter toggle */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="w-full border-brand-border pr-10 pl-10 focus:border-brand"
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    updateUrl({ q: e.target.value || null });
                  }}
                  placeholder={t("filters.searchPlaceholder")}
                  type="text"
                  value={searchQuery}
                />
                {searchQuery && (
                  <button
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground"
                    onClick={() => {
                      setSearchQuery("");
                      updateUrl({ q: null });
                    }}
                    type="button"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Button
                onClick={() => setShowFilters((v) => !v)}
                size="sm"
                variant={showFilters ? "default" : "outline"}
              >
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                Filters
                {hasActiveFilters && (
                  <span className="ml-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[10px] text-white font-medium">
                    !
                  </span>
                )}
              </Button>
            </div>

            {/* Expanded filters */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  animate={{ height: "auto", opacity: 1 }}
                  className="overflow-hidden"
                  exit={{ height: 0, opacity: 0 }}
                  initial={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex flex-wrap items-center gap-3 pb-2">
                    {departments.length > 1 && (
                      <Select
                        onValueChange={(v) => {
                          setDepartment(v);
                          updateUrl({ department: v });
                        }}
                        value={department}
                      >
                        <SelectTrigger className="h-9 w-48">
                          <SelectValue placeholder="Department" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All departments</SelectItem>
                          {departments.map(([id, name]) => (
                            <SelectItem key={id} value={id}>
                              {name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {employmentTypes.length > 1 && (
                      <Select
                        onValueChange={(v) => {
                          setEmploymentType(v);
                          updateUrl({ type: v });
                        }}
                        value={employmentType}
                      >
                        <SelectTrigger className="h-9 w-40">
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All types</SelectItem>
                          {employmentTypes.map((type) => (
                            <SelectItem key={type} value={type ?? ""}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    <Select
                      onValueChange={(v) => {
                        setSort(v as SortOption);
                        updateUrl({ sort: v });
                      }}
                      value={sort}
                    >
                      <SelectTrigger className="h-9 w-44">
                        <SelectValue placeholder="Sort" />
                      </SelectTrigger>
                      <SelectContent>
                        {SORT_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      className={
                        showPaidOnly
                          ? "h-9 border-0 bg-linear-to-r from-green-500 to-emerald-600 text-white"
                          : "h-9 border-green-500/20 text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
                      }
                      onClick={() => {
                        const next = !showPaidOnly;
                        setShowPaidOnly(next);
                        updateUrl({ paid: next ? "true" : null });
                      }}
                      size="sm"
                      variant={showPaidOnly ? "default" : "outline"}
                    >
                      <DollarSign className="mr-1.5 h-4 w-4" />
                      {t("filters.paidOnly")}
                    </Button>

                    {hasActiveFilters && (
                      <Button
                        className="h-9"
                        onClick={clearAllFilters}
                        size="sm"
                        variant="ghost"
                      >
                        <X className="mr-1.5 h-4 w-4" />
                        {t("emptyState.clearFilters")}
                      </Button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <p className="text-center text-muted-foreground text-sm">
              {t("filters.showingResults", { count: filteredJobs.length })}
            </p>
          </div>
        </div>
      </div>

      {/* Job grid */}
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <AnimatePresence mode="wait">
          {filteredJobs.length > 0 ? (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="grid gap-8 md:grid-cols-2"
              exit={{ opacity: 0, y: -20 }}
              initial={{ opacity: 0, y: 20 }}
              key={`jobs-${filteredJobs.length}-${searchQuery}-${showPaidOnly}-${sort}`}
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
          ) : (
            <motion.div
              animate={{ opacity: 1 }}
              className="py-20 text-center"
              initial={{ opacity: 0 }}
              key="empty"
            >
              <h3 className="mb-2 font-bold text-2xl text-foreground">
                {t("emptyState.title")}
              </h3>
              <p className="mb-6 text-muted-foreground">
                {t("emptyState.description")}
              </p>
              <Button
                className="border-brand text-brand-dark hover:bg-brand-muted"
                onClick={clearAllFilters}
                variant="outline"
              >
                {t("emptyState.clearFilters")}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
