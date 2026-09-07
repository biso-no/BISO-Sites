"use client";

import type { RecruitmentVacancy } from "@repo/shared/types/recruitment";
import {
  UNIT_CATEGORY_MESSAGE_KEYS,
  type UnitCategory,
} from "@repo/shared/utils/unit-categories";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { useListParams, useUrlSearch } from "@repo/ui/hooks/use-list-params";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { type JobSort, listJobs } from "@/app/actions/jobs";
import { useCampus } from "@/components/context/campus";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { useLoadMore } from "@/lib/use-load-more";
import { JobCard } from "./job-card";

interface JobsListClientProps {
  capped: boolean;
  categories: UnitCategory[];
  departments: [string, string][];
  initialJobs: RecruitmentVacancy[];
  initialSearch: string;
  locale: string;
  selectedCategory: string | null;
  selectedDepartment: string | null;
  sort: JobSort;
  total: number;
}

const SORT_OPTIONS = [
  { label: "Newest first", value: "newest" },
  { label: "Deadline (soonest)", value: "deadline" },
] as const;

export function JobsListClient({
  capped,
  categories,
  departments,
  initialJobs,
  initialSearch,
  locale,
  selectedCategory,
  selectedDepartment,
  sort,
  total,
}: JobsListClientProps) {
  const t = useTranslations("jobs");
  const router = useRouter();
  const { activeCampusId } = useCampus();
  const [showFilters, setShowFilters] = useState(false);

  const { setParams } = useListParams();
  const [searchValue, setSearchValue] = useUrlSearch("q");

  const { canLoadMore, error, isLoading, items, loadMore } = useLoadMore({
    initial: initialJobs,
    total,
    fetchPage: useCallback(
      (page: number) =>
        listJobs({
          campus: activeCampusId ?? null,
          category: selectedCategory,
          department: selectedDepartment,
          locale,
          page,
          search: initialSearch,
          sort,
        }),
      [
        activeCampusId,
        selectedCategory,
        selectedDepartment,
        locale,
        initialSearch,
        sort,
      ]
    ),
  });

  // When campus switcher changes, re-fetch via URL update (triggers server rerender)
  useEffect(() => {
    if (activeCampusId === undefined) {
      return; // still loading
    }
    const current = new URLSearchParams(window.location.search).get("campus");
    const next = activeCampusId ?? "all";
    if (current !== next && !(current === null && next === "all")) {
      setParams({ campus: next === "all" ? null : next });
    }
  }, [activeCampusId, setParams]);

  function clearAllFilters() {
    setSearchValue("");
    setParams({ q: null, category: null, department: null, sort: null });
  }

  const hasActiveFilters =
    searchValue.length > 0 ||
    selectedDepartment !== null ||
    selectedCategory !== null ||
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
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder={t("filters.searchPlaceholder")}
                  type="text"
                  value={searchValue}
                />
                {searchValue && (
                  <button
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setSearchValue("")}
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
                  <span className="ml-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand font-medium text-[10px] text-white">
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
                        onValueChange={(v) =>
                          setParams({ department: v === "all" ? null : v })
                        }
                        value={selectedDepartment ?? "all"}
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

                    {categories.length > 0 && (
                      <Select
                        onValueChange={(v) =>
                          setParams({ category: v === "all" ? null : v })
                        }
                        value={selectedCategory ?? "all"}
                      >
                        <SelectTrigger className="h-9 w-48">
                          <SelectValue placeholder={t("filters.all")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">
                            {t("filters.all")}
                          </SelectItem>
                          {categories.map((value) => (
                            <SelectItem key={value} value={value}>
                              {t(
                                `filters.${UNIT_CATEGORY_MESSAGE_KEYS[value]}`
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    <Select
                      onValueChange={(v) =>
                        setParams({ sort: v === "newest" ? null : v })
                      }
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
              {capped
                ? t("filters.showingFirstResults", { count: total })
                : t("filters.showingResults", { count: total })}
            </p>
          </div>
        </div>
      </div>

      {/* Job grid */}
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <AnimatePresence mode="wait">
          {items.length > 0 ? (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="grid gap-8 md:grid-cols-2"
              exit={{ opacity: 0, y: -20 }}
              initial={{ opacity: 0, y: 20 }}
              key="jobs-grid"
            >
              {items.map((job, index) => (
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
                {t("emptyState.seasonalTitle")}
              </h3>
              <p className="mx-auto mb-8 max-w-md text-muted-foreground">
                {t("emptyState.seasonalBody")}
              </p>
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <Button asChild>
                  <a href="mailto:jobs@biso.no">
                    {t("emptyState.interestCta")}
                  </a>
                </Button>
                {hasActiveFilters && (
                  <Button
                    className="border-brand text-brand-dark hover:bg-brand-muted"
                    onClick={clearAllFilters}
                    variant="outline"
                  >
                    {t("emptyState.clearFilters")}
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <LoadMoreButton
          canLoadMore={canLoadMore}
          error={error}
          isLoading={isLoading}
          label={t("filters.loadMore")}
          loadingLabel={t("filters.loading")}
          onLoadMore={loadMore}
          retryLabel={t("filters.loadMoreFailed")}
        />
      </div>
    </>
  );
}
