"use client";

import type { ContentTranslations } from "@repo/api/types/appwrite";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import {
  BookOpen,
  Briefcase,
  Cog,
  DollarSign,
  Filter,
  PartyPopper,
  Rocket,
  Search,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { JobCard } from "./job-card";

type JobsListClientProps = {
  jobs: ContentTranslations[];
};

const getJobCategory = (metadata: Record<string, any>) =>
  metadata.category || "General";

const _parseJobMetadata = (metadata: Record<string, any>) => metadata || {};

const getCategoriesWithTranslations = (t: (key: string) => string) => [
  {
    name: "All",
    label: t("filters.all"),
    icon: Briefcase,
    color: "from-brand-gradient-from to-brand-gradient-to",
  },
  {
    name: "Academic Associations",
    label: t("filters.academicAssociations"),
    icon: BookOpen,
    color: "from-blue-500 to-indigo-600",
  },
  {
    name: "Societies",
    label: t("filters.societies"),
    icon: PartyPopper,
    color: "from-brand-gradient-from to-cyan-500",
  },
  {
    name: "Staff Functions",
    label: t("filters.staffFunctions"),
    icon: Cog,
    color: "from-brand-gradient-to to-slate-700",
  },
  { 
    name: "Projects", 
    label: t("filters.projects"),
    icon: Rocket, 
    color: "from-purple-500 to-pink-500" 
  },
];

export function JobsListClient({ jobs }: JobsListClientProps) {
  const t = useTranslations("jobs");
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [showPaidOnly, setShowPaidOnly] = useState(false);
  
  const categories = getCategoriesWithTranslations(t);

  // Filter jobs based on search, category, and paid status
  const filteredJobs = jobs.filter((job) => {
    const jobData = job.job_ref;
    const metadata = jobData?.metadata as Record<string, any>;
    const category = getJobCategory(metadata);
    const paid = metadata.paid ?? false;
    const department = jobData?.department?.Name || "";

    const matchesCategory =
      selectedCategory === "All" || category === selectedCategory;
    const matchesSearch =
      job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (job.short_description || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      department.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPaid = !showPaidOnly || paid;

    return matchesCategory && matchesSearch && matchesPaid;
  });

  const handleViewDetails = (job: ContentTranslations) => {
    // Use slug if available, otherwise fall back to content_id
    const slug = job.job_ref?.slug || job.content_id;
    router.push(`/jobs/${slug}`);
  };

  return (
    <>
      {/* Filters & Search */}
      <div className="sticky top-20 z-40 border-border border-b bg-background/95 shadow-lg backdrop-blur-lg">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4">
            {/* Search */}
            <div className="relative w-full">
              <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-5 w-5 text-muted-foreground" />
              <Input
                className="w-full border-brand-border pr-10 pl-10 focus:border-brand"
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("filters.searchPlaceholder")}
                type="text"
                value={searchQuery}
              />
              {searchQuery && (
                <button
                  className="-translate-y-1/2 absolute top-1/2 right-3 text-muted-foreground hover:text-muted-foreground"
                  onClick={() => setSearchQuery("")}
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap items-center gap-3">
              <Filter className="h-5 w-5 text-brand-dark" />
              {categories.map((category) => {
                const Icon = category.icon;
                return (
                  <Button
                    className={
                      selectedCategory === category.name
                        ? `bg-linear-to-r ${category.color} border-0 text-white`
                        : "border-brand-border text-brand-dark hover:bg-brand-muted"
                    }
                    key={category.name}
                    onClick={() => setSelectedCategory(category.name)}
                    variant={
                      selectedCategory === category.name ? "default" : "outline"
                    }
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {category.label}
                  </Button>
                );
              })}

              {/* Paid Filter */}
              <div className="ml-auto flex items-center gap-2">
                <Button
                  className={
                    showPaidOnly
                      ? "border-0 bg-linear-to-r from-green-500 to-emerald-600 text-white"
                      : "border-green-500/20 text-green-700 hover:bg-green-50"
                  }
                  onClick={() => setShowPaidOnly(!showPaidOnly)}
                  variant={showPaidOnly ? "default" : "outline"}
                >
                  <DollarSign className="mr-2 h-4 w-4" />
                  {t("filters.paidOnly")}
                </Button>
              </div>
            </div>

            <div className="text-center text-muted-foreground text-sm">
              {t("filters.showingResults", { count: filteredJobs.length })}
            </div>
          </div>
        </div>
      </div>

      {/* Positions Grid */}
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <AnimatePresence mode="wait">
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="grid gap-8 md:grid-cols-2"
            exit={{ opacity: 0, y: -20 }}
            initial={{ opacity: 0, y: 20 }}
            key={selectedCategory + searchQuery + showPaidOnly}
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

        {/* No Results */}
        {filteredJobs.length === 0 && (
          <motion.div
            animate={{ opacity: 1 }}
            className="py-20 text-center"
            initial={{ opacity: 0 }}
          >
            <Briefcase className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
            <h3 className="mb-2 font-bold text-2xl text-foreground">
              {t("emptyState.title")}
            </h3>
            <p className="mb-6 text-muted-foreground">
              {t("emptyState.description")}
            </p>
            <Button
              className="border-brand text-brand-dark hover:bg-brand-muted"
              onClick={() => {
                setSelectedCategory("All");
                setSearchQuery("");
                setShowPaidOnly(false);
              }}
              variant="outline"
            >
              {t("emptyState.clearFilters")}
            </Button>
          </motion.div>
        )}
      </div>

      {/* CTA Section */}
      <div className="bg-linear-to-r from-brand-gradient-to to-brand-gradient-from py-16">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h2 className="mb-4 font-bold text-3xl text-white">
            {t("cta.title")}
          </h2>
          <p className="mb-8 text-lg text-white/90">
            {t("cta.description")}
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button className="bg-background text-brand-dark hover:bg-background/90">
              {t("cta.contactButton")}
            </Button>
            <Button
              className="border-white text-white hover:bg-background/10"
              variant="outline"
            >
              {t("cta.downloadButton")}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
